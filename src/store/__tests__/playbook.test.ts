import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../data/defaults'
import { clonePlaybook } from '../../lib/library'
import { DEFAULT_ROUTE_TREE_SETTINGS } from '../../lib/routeTree'
import type { Playbook, WristCoachSettings } from '../../types'

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

const book = (id: string, name: string): Playbook => ({
  ...(JSON.parse(JSON.stringify(DEFAULT_PLAYBOOK)) as Playbook),
  id,
  name,
})

describe('playbook library store', () => {
  const alpha = book('alpha', 'Alpha')
  // A real copy, so its plays carry their own ids.
  const beta = { ...clonePlaybook(alpha, 'Beta'), id: 'beta' }
  let store: typeof import('../playbook')
  let baseWrist: WristCoachSettings

  beforeAll(async () => {
    const localStorage = storage()
    const sessionStorage = storage()
    vi.stubGlobal('window', { localStorage, sessionStorage })
    vi.stubGlobal('localStorage', localStorage)
    vi.stubGlobal('sessionStorage', sessionStorage)
    store = await import('../playbook')
    baseWrist = store.usePlaybook.getState().wrist
  })

  beforeEach(() => {
    store.usePlaybook.setState({
      playbooks: [alpha, beta],
      activeId: alpha.id,
      wrist: { ...baseWrist, selectedPlayIds: alpha.plays.map((play) => play.id) },
    })
  })

  it('switches the open playbook and keeps a usable wrist-coach selection', () => {
    const state = store.usePlaybook.getState()
    state.selectPlaybook(beta.id)

    expect(store.usePlaybook.getState().activeId).toBe(beta.id)
    // Play ids do not travel between playbooks, so the selection starts fresh.
    expect(store.usePlaybook.getState().wrist.selectedPlayIds).toEqual(
      beta.plays.map((play) => play.id),
    )

    store.usePlaybook.getState().setWristPlays([beta.plays[0].id])
    store.usePlaybook.getState().selectPlaybook(alpha.id)
    expect(store.usePlaybook.getState().wrist.selectedPlayIds).toEqual(
      alpha.plays.map((play) => play.id),
    )
  })

  it('adds a new playbook in front of an existing one', () => {
    store.usePlaybook.getState().createPlaybook('Friday night', 'Falcons')

    const state = store.usePlaybook.getState()
    expect(state.playbooks.map((playbook) => playbook.name)).toEqual([
      'Alpha',
      'Beta',
      'Friday night',
    ])
    expect(state.activeId).toBe(state.playbooks[2].id)
    expect(store.activePlaybook(state).team).toBe('Falcons')
  })

  it('duplicates a playbook beside its source with fresh ids', () => {
    const copyId = store.usePlaybook.getState().duplicatePlaybook(alpha.id)
    const state = store.usePlaybook.getState()

    expect(state.playbooks.map((playbook) => playbook.name)).toEqual([
      'Alpha',
      'Alpha copy',
      'Beta',
    ])
    expect(state.activeId).toBe(copyId)
    const copy = state.playbooks[1]
    expect(copy.id).toBe(copyId)
    expect(copy.plays[0].id).not.toBe(alpha.plays[0].id)
    expect(copy.formations[0].id).not.toBe(alpha.formations[0].id)
  })

  it('deletes a playbook but never the last one', () => {
    store.usePlaybook.getState().deletePlaybook(beta.id)
    expect(store.usePlaybook.getState().playbooks.map((playbook) => playbook.id)).toEqual([
      'alpha',
    ])
    expect(store.usePlaybook.getState().activeId).toBe('alpha')

    store.usePlaybook.getState().deletePlaybook('alpha')
    expect(store.usePlaybook.getState().playbooks).toHaveLength(1)
  })

  it('moves the editor when the open playbook is deleted', () => {
    store.usePlaybook.getState().deletePlaybook(alpha.id)

    expect(store.usePlaybook.getState().activeId).toBe('beta')
  })

  it('adds an imported playbook as its own entry', () => {
    const imported = book('alpha', 'Alpha')
    const addedId = store.usePlaybook.getState().addPlaybook(imported)

    const state = store.usePlaybook.getState()
    expect(state.playbooks).toHaveLength(3)
    expect(state.activeId).toBe(addedId)
    expect(addedId).not.toBe(imported.id)
    expect(state.playbooks[2].name).toBe('Alpha 2')
    expect(state.playbooks[2].plays[0].id).not.toBe(alpha.plays[0].id)
    // The open playbook is untouched by an import.
    expect(state.playbooks[0]).toEqual(alpha)
  })

  it('replaces the library and keeps the open playbook when it survives', () => {
    const gamma = book('gamma', 'Gamma')
    store.usePlaybook.setState({ activeId: beta.id })
    store.usePlaybook.getState().replaceLibrary([beta, gamma])

    expect(store.usePlaybook.getState().activeId).toBe(beta.id)
    expect(store.usePlaybook.getState().playbooks.map((playbook) => playbook.id)).toEqual([
      'beta',
      'gamma',
    ])

    store.usePlaybook.getState().replaceLibrary([gamma, alpha])
    expect(store.usePlaybook.getState().activeId).toBe('gamma')
  })
})

describe('stored state migration', () => {
  const alpha = book('alpha', 'Alpha')
  let store: typeof import('../playbook')

  beforeAll(async () => {
    vi.stubGlobal('localStorage', storage())
    vi.stubGlobal('sessionStorage', storage())
    store = await import('../playbook')
  })

  it('turns a pre-library browser into a one-playbook library', () => {
    const migrated = store.migrateStoredState({
      playbook: alpha,
      wrist: { selectedPlayIds: [alpha.plays[0].id] },
    })

    expect(migrated.playbooks?.map((playbook) => playbook.id)).toEqual(['alpha'])
    expect(migrated.activeId).toBe('alpha')
    expect(migrated.wrist?.selectedPlayIds).toEqual([alpha.plays[0].id])
    expect(migrated.routeTree).toEqual(DEFAULT_ROUTE_TREE_SETTINGS)
  })

  it('gives a pre-route-library playbook the standard routes', () => {
    const { routes: _routes, ...withoutRoutes } = alpha
    const migrated = store.migrateStoredState({ playbook: withoutRoutes as Playbook })

    expect(migrated.playbooks?.[0].routes).toEqual(DEFAULT_PLAYBOOK.routes)
  })

  it('drops a wrist-coach selection that no longer resolves', () => {
    const migrated = store.migrateStoredState({
      playbook: alpha,
      wrist: { selectedPlayIds: ['gone'] },
    })

    expect(migrated.wrist?.selectedPlayIds).toEqual(alpha.plays.map((play) => play.id))
  })

  it('keeps a valid active id and repairs a stale one', () => {
    const good = store.migrateStoredState({ playbooks: [alpha], activeId: 'alpha' })
    expect(good.activeId).toBe('alpha')

    const repaired = store.migrateStoredState({ playbooks: [alpha], activeId: 'missing' })
    expect(repaired.activeId).toBe('alpha')
  })

  it('passes an empty state through untouched', () => {
    expect(store.migrateStoredState(undefined)).toEqual({})
  })
})
