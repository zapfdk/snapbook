import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../data/defaults'
import { playbookHash, planCloudSync } from '../syncLogic'

const plan = (overrides: Partial<Parameters<typeof planCloudSync>[0]> = {}) =>
  planCloudSync({
    remoteExists: true,
    remoteRev: 'rev-1',
    localHash: 'local-1',
    syncedRev: 'rev-1',
    syncedHash: 'local-1',
    ...overrides,
  })

describe('cloud sync direction', () => {
  it('uploads when the app folder has no playbook yet', () => {
    expect(plan({ remoteExists: false, remoteRev: null, syncedRev: null, syncedHash: null })).toBe(
      'upload',
    )
  })

  it('does nothing when both sides match the last sync', () => {
    expect(plan()).toBe('up-to-date')
  })

  it('downloads remote changes when this browser is unchanged', () => {
    expect(plan({ remoteRev: 'rev-2' })).toBe('download')
  })

  it('uploads local changes when the remote revision is unchanged', () => {
    expect(plan({ localHash: 'local-2' })).toBe('upload')
  })

  it('compares both copies when both sides changed', () => {
    expect(plan({ remoteRev: 'rev-2', localHash: 'local-2' })).toBe('compare')
  })

  it('compares on a first connection with an existing remote file', () => {
    expect(plan({ syncedRev: null, syncedHash: null })).toBe('compare')
  })
})

describe('playbookHash', () => {
  it('ignores local ids, timestamps and object identity', () => {
    const copy = JSON.parse(JSON.stringify(DEFAULT_PLAYBOOK)) as typeof DEFAULT_PLAYBOOK
    copy.id = 'different-book'
    copy.plays[0].id = 'different-play'
    copy.plays[0].players[0].id = 'different-player'
    copy.plays[0].updatedAt = '2030-01-01T00:00:00.000Z'

    expect(playbookHash(DEFAULT_PLAYBOOK)).toBe(playbookHash(copy))
  })

  it('changes when coaching content changes', () => {
    const changed = {
      ...DEFAULT_PLAYBOOK,
      name: `${DEFAULT_PLAYBOOK.name} changed`,
    }
    expect(playbookHash(DEFAULT_PLAYBOOK)).not.toBe(playbookHash(changed))
  })
})
