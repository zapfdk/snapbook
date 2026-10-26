import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../data/defaults'
import { serializeSnapbook } from '../files'
import type { Playbook } from '../../types'

const storage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('cloud sync coordinator', () => {
  const local = JSON.parse(JSON.stringify(DEFAULT_PLAYBOOK)) as Playbook
  const remote = { ...local, name: 'Dropbox copy' }
  let remoteRev = 'rev-new'
  let uploaded: { body: string; rev: string | null } | null = null
  let localStore: typeof import('../../store/playbook')
  let sync: typeof import('../cloudSync')

  beforeAll(async () => {
    const localStorage = storage()
    const sessionStorage = storage()
    Object.assign(import.meta.env as Record<string, string>, {
      VITE_DROPBOX_APP_KEY: 'test-key',
    })

    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/snapbook/',
        search: '',
      },
      history: { replaceState: vi.fn() },
      addEventListener: vi.fn(),
      localStorage,
      sessionStorage,
    })
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('sessionStorage', sessionStorage)
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      visibilityState: 'visible',
    })

    localStorage.setItem(
      'snapbook.cloud.dropbox.v1',
      JSON.stringify({
        version: 1,
        refreshToken: 'refresh',
        accountLabel: 'Test Dropbox',
        accountId: 'dbid:test',
        remoteRev: 'rev-old',
        lastSyncedAt: '2026-10-24T12:00:00.000Z',
        lastSyncedHash: 'old-local-hash',
      }),
    )
    sessionStorage.setItem(
      'snapbook.cloud.dropbox.access.v1',
      JSON.stringify({
        token: 'access-token',
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/2/files/get_metadata')) {
          return new Response(JSON.stringify({ rev: remoteRev, path_display: '/snapbook.json' }))
        }
        if (url.endsWith('/2/files/download')) {
          return new Response(serializeSnapbook(remote))
        }
        if (url.endsWith('/2/files/upload')) {
          const args = JSON.parse(
            (init?.headers as Record<string, string>)['Dropbox-API-Arg'],
          ) as { mode: { '.tag': string; update?: string } }
          uploaded = {
            body: String(init?.body ?? ''),
            rev: args.mode.update ?? null,
          }
          remoteRev = 'rev-uploaded'
          return new Response(JSON.stringify({ rev: remoteRev }))
        }
        throw new Error(`Unexpected Dropbox request: ${url}`)
      }) as unknown as typeof fetch,
    )

    localStore = await import('../../store/playbook')
    localStore.usePlaybook.setState({ playbook: local })
    sync = await import('../cloudSync')
  })

  it('stops on a conflict, can keep the local copy, then pulls later remote changes', async () => {
    await sync.initializeCloudSync()
    expect(sync.getCloudSyncState().phase).toBe('conflict')
    expect(sync.getCloudSyncState().conflict?.remotePlaybook.name).toBe('Dropbox copy')

    await sync.resolveCloudConflict('local')
    expect(sync.getCloudSyncState().phase).toBe('connected')
    expect(uploaded?.rev).toBe('rev-new')
    expect(JSON.parse(uploaded!.body).playbook.name).toBe(DEFAULT_PLAYBOOK.name)

    const nextRemote = { ...local, name: 'Remote after edit' }
    Object.assign(remote, nextRemote)
    remoteRev = 'rev-remote-2'

    await sync.syncCloudNow()
    expect(sync.getCloudSyncState().phase).toBe('connected')
    expect(localStore.usePlaybook.getState().playbook.name).toBe('Remote after edit')
  })
})
