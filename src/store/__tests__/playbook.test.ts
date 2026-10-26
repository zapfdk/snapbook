import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../data/defaults'
import { clonePlaybook } from '../../lib/library'
import { DEFAULT_ROUTE_TREE_SETTINGS } from '../../lib/routeTree'
import type { Playbook, Point, RoutePoint, WristCoachSettings } from '../../types'

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

  it('duplicates a route beside its source with a free name', () => {
    const source = alpha.routes[2]
    const copy = store.usePlaybook.getState().duplicateRoute(source.id)

    expect(copy).not.toBeNull()
    expect(copy!.id).not.toBe(source.id)
    expect(copy!.name).toBe(`${source.name} copy`)
    expect(copy!.points).toEqual(source.points)
    expect(copy!.points[0]).not.toBe(source.points[0])

    const routes = store.usePlaybook.getState().playbooks[0].routes
    expect(routes[3].id).toBe(copy!.id)
    expect(routes[2]).toEqual(source)

    const again = store.usePlaybook.getState().duplicateRoute(source.id)
    expect(again!.name).toBe(`${source.name} copy 2`)

    expect(store.usePlaybook.getState().duplicateRoute('missing')).toBeNull()
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

describe('routes written into a play', () => {
  const boundary = (pos: Point, points: RoutePoint[] | null): Playbook => ({
    ...book('boundary', 'Boundary'),
    plays: [
      {
        id: 'boundary-play',
        name: 'Boundary',
        codeName: '',
        formationId: 'none',
        players: [
          {
            id: 'wr',
            role: 'Wide Receiver Left',
            label: 'WR-L',
            number: 11,
            color: '#FF8265',
            pos,
            route: points ? { id: 'route', points } : null,
          },
        ],
        categories: [],
        notes: '',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
  })

  let store: typeof import('../playbook')

  beforeAll(async () => {
    vi.stubGlobal('localStorage', storage())
    vi.stubGlobal('sessionStorage', storage())
    store = await import('../playbook')
  })

  const install = (playbook: Playbook) => {
    store.usePlaybook.setState({ playbooks: [playbook], activeId: playbook.id })
  }

  const points = () =>
    store.usePlaybook.getState().playbooks[0].plays[0].players[0].route?.points

  it('mirrors a route and restores it exactly when flipped back', () => {
    // The receiver is aligned at the left edge, so the mirror points off the
    // field. The stored route keeps its real shape and flipping back is a
    // plain mirror of it, so nothing the coach drew is lost.
    const original = [{ x: 0, y: 3 }, { x: 2, y: 6, curve: 1.2 }]
    install(boundary({ x: -11, y: 0 }, original.map((point) => ({ ...point }))))

    store.usePlaybook.getState().flipPlayerRoute('boundary-play', 'wr')
    expect(points()).toEqual([{ x: 0, y: 3 }, { x: -2, y: 6, curve: -1.2 }])

    store.usePlaybook.getState().flipPlayerRoute('boundary-play', 'wr')
    expect(points()).toEqual(original)
  })

  it('keeps a library route exactly as the library holds it', () => {
    install(boundary({ x: -11, y: 0 }, null))

    store.usePlaybook.getState().applyRoutePreset('boundary-play', 'wr', 'out')

    expect(points()).toEqual([{ x: 0, y: 8 }, { x: -6, y: 8, curve: -0.6 }])
  })

  it('clamps a hand-written route and keeps its bows', () => {
    install(boundary({ x: -11, y: 0 }, null))

    store.usePlaybook.getState().setPlayerRoute('boundary-play', 'wr', [
      { x: -30, y: 0 },
      { x: 5, y: 40, curve: 1.5 },
    ])

    expect(points()).toEqual([{ x: -1.4, y: 0 }, { x: 5, y: 17.4, curve: 1.5 }])
  })
})
