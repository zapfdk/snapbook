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

describe('motions and option routes in a play', () => {
  const motionBook = (): Playbook => ({
    ...book('motion', 'Motion'),
    plays: [
      {
        id: 'motion-play',
        name: 'Motion',
        codeName: '',
        formationId: 'none',
        players: [
          {
            id: 'wr',
            role: 'Wide Receiver Left',
            label: 'WR-L',
            number: 11,
            color: '#FF8265',
            pos: { x: -11, y: 0 },
            route: null,
            motion: null,
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

  const install = () => {
    const playbook = motionBook()
    store.usePlaybook.setState({ playbooks: [playbook], activeId: playbook.id })
  }

  const player = () => store.usePlaybook.getState().playbooks[0].plays[0].players[0]

  it('stores a motion clamped to the field', () => {
    install()

    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [
      { x: -30, y: 2 },
      { x: 0, y: 40 },
    ])

    expect(player().motion?.points).toEqual([{ x: -1.4, y: 2 }, { x: 0, y: 17.4 }])
    expect(player().route).toBeNull()
  })

  it('replaces and clears a motion without touching the route', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [{ x: 0, y: 3 }])
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [{ x: 2, y: 0 }])
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [{ x: 3, y: 0 }])

    expect(player().motion?.points).toEqual([{ x: 3, y: 0 }])
    expect(player().route?.points).toEqual([{ x: 0, y: 3 }])

    store.usePlaybook.getState().clearPlayerMotion('motion-play', 'wr')
    expect(player().motion).toBeNull()
    expect(player().route?.points).toEqual([{ x: 0, y: 3 }])
  })

  it('copies the motion and every option branch into a duplicated play', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 1, [{ x: 8, y: 8 }])
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [{ x: 2, y: 0 }])

    const source = player()
    const copyId = store.usePlaybook.getState().duplicatePlay('motion-play')
    const copy = store.usePlaybook
      .getState()
      .playbooks[0].plays.find((play) => play.id === copyId)

    expect(copy?.players[0].motion?.points).toEqual([{ x: 2, y: 0 }])
    expect(copy?.players[0].motion?.id).not.toBe(source.motion?.id)
    expect(copy?.players[0].route?.options).toEqual([
      { id: expect.any(String), from: 1, points: [{ x: 8, y: 8 }] },
    ])
    expect(copy?.players[0].route?.id).not.toBe(source.route?.id)
    expect(copy?.players[0].route?.options?.[0].id).not.toBe(source.route?.options?.[0].id)
  })

  it('stores an option branch clamped to the field, only from a real route point', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ])

    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 1, [
      { x: -30, y: 40 },
    ])
    // A branch needs a route point to leave from and at least one point of its own.
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 5, [{ x: 1, y: 1 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', -1, [{ x: 1, y: 1 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [])

    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 1, points: [{ x: -1.4, y: 17.4 }] },
    ])
  })

  it('removes one branch without touching the route or the other branches', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: -4, y: 5 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 1, [{ x: 8, y: 8 }])

    const first = player().route?.options?.[0]
    store.usePlaybook.getState().removePlayerRouteOption('motion-play', 'wr', first!.id)

    expect(player().route?.points).toEqual([{ x: 0, y: 3 }, { x: 4, y: 8 }])
    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 1, points: [{ x: 8, y: 8 }] },
    ])

    store.usePlaybook
      .getState()
      .removePlayerRouteOption('motion-play', 'wr', player().route!.options![0].id)
    expect(player().route?.options).toBeUndefined()
    expect(player().route?.points).toHaveLength(2)
  })

  it('measures a hand-written route from where the motion ends', () => {
    install()
    // The receiver lines up on the left sideline and motions four yards inside.
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [{ x: 4, y: 0 }])
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: -30, y: 0 },
      { x: 0, y: 3 },
    ])

    // Clamped around the end of the motion at x = -7, not the marker at x = -11.
    expect(player().route?.points).toEqual([{ x: -5.4, y: 0 }, { x: 0, y: 3 }])
  })

  it('measures an option branch from where the motion ends', () => {
    install()
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [{ x: 4, y: 0 }])
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [{ x: 0, y: 3 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [
      { x: -20, y: 4 },
    ])

    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 0, points: [{ x: -5.4, y: 4 }] },
    ])
  })

  it('edits a branch in place, branch point and points together', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: -4, y: 4 }])
    const option = player().route!.options![0]

    store.usePlaybook.getState().updatePlayerRouteOption('motion-play', 'wr', option.id, 1, [
      { x: 2, y: 9 },
      { x: -30, y: 40 },
    ])

    expect(player().route?.points).toEqual([{ x: 0, y: 3 }, { x: 4, y: 8 }])
    expect(player().route?.options).toEqual([
      { id: option.id, from: 1, points: [{ x: 2, y: 9 }, { x: -1.4, y: 17.4 }] },
    ])
  })

  it('drops a branch edited down to nothing and ignores edits it cannot make', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: -4, y: 4 }])
    const option = player().route!.options![0]

    // A branch can only leave a route point that exists.
    store.usePlaybook
      .getState()
      .updatePlayerRouteOption('motion-play', 'wr', option.id, 2, [{ x: 1, y: 1 }])
    expect(player().route?.options?.[0].from).toBe(0)

    // An option that is not on the route is left alone.
    store.usePlaybook
      .getState()
      .updatePlayerRouteOption('motion-play', 'wr', 'missing', 0, [{ x: 1, y: 1 }])
    expect(player().route?.options).toHaveLength(1)

    // With no points left there is nothing to run, so the branch goes.
    store.usePlaybook.getState().updatePlayerRouteOption('motion-play', 'wr', option.id, 1, [])
    expect(player().route?.options).toBeUndefined()
    expect(player().route?.points).toHaveLength(2)
  })

  it('removes a route point and takes the branch that left it along', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 2, y: 6 },
      { x: 4, y: 9 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 2, [{ x: 6, y: 10 }])
    // The receiver is on the left sideline, so this branch is clamped there.
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: -4, y: 4 }])

    store.usePlaybook.getState().removePlayerRoutePoint('motion-play', 'wr', 2)

    expect(player().route?.points).toEqual([{ x: 0, y: 3 }, { x: 2, y: 6 }])
    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 0, points: [{ x: -1.4, y: 4 }] },
    ])
  })

  it('keeps a branch on its own point when an earlier route point goes', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 2, y: 6 },
      { x: 4, y: 9 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 2, [{ x: 6, y: 10 }])

    store.usePlaybook.getState().removePlayerRoutePoint('motion-play', 'wr', 1)

    expect(player().route?.points).toEqual([{ x: 0, y: 3 }, { x: 4, y: 9 }])
    // The branch still leaves the third point, which is now at index 1.
    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 1, points: [{ x: 6, y: 10 }] },
    ])
  })

  it('clears a route whose last point goes and ignores an index that is not there', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [{ x: 0, y: 3 }])

    store.usePlaybook.getState().removePlayerRoutePoint('motion-play', 'wr', 4)
    expect(player().route?.points).toEqual([{ x: 0, y: 3 }])

    store.usePlaybook.getState().removePlayerRoutePoint('motion-play', 'wr', 0)
    expect(player().route).toBeNull()
  })

  it('removes motion points and clears a motion that is emptied', () => {
    install()
    store.usePlaybook.getState().setPlayerMotion('motion-play', 'wr', [
      { x: 2, y: 0 },
      { x: 4, y: 1 },
    ])

    store.usePlaybook.getState().removePlayerMotionPoint('motion-play', 'wr', 0)
    expect(player().motion?.points).toEqual([{ x: 4, y: 1 }])

    store.usePlaybook.getState().removePlayerMotionPoint('motion-play', 'wr', 0)
    expect(player().motion).toBeNull()
  })

  it('removes an option point and drops a branch left with none', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [{ x: 0, y: 3 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [
      { x: 2, y: 6 },
      { x: 4, y: 9 },
    ])
    const option = player().route!.options![0]

    store.usePlaybook.getState().removePlayerOptionPoint('motion-play', 'wr', option.id, 1)
    expect(player().route?.options).toEqual([
      { id: option.id, from: 0, points: [{ x: 2, y: 6 }] },
    ])

    store.usePlaybook.getState().removePlayerOptionPoint('motion-play', 'wr', option.id, 0)
    expect(player().route?.options).toBeUndefined()
    expect(player().route?.points).toEqual([{ x: 0, y: 3 }])
  })

  it('keeps branches within reach when the route changes and flips them with it', () => {
    install()
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 2, y: 6 },
      { x: 4, y: 9 },
    ])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: -4, y: 4 }])
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 2, [{ x: 9, y: 9 }])

    // Shortening the route drops the branch that pointed at the lost point.
    store.usePlaybook.getState().setPlayerRoute('motion-play', 'wr', [
      { x: 0, y: 3 },
      { x: 2, y: 7 },
    ])
    // The receiver is on the left sideline, so the branch point is clamped there.
    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 0, points: [{ x: -1.4, y: 4 }] },
    ])

    store.usePlaybook.getState().flipPlayerRoute('motion-play', 'wr')
    expect(player().route?.points).toEqual([{ x: 0, y: 3 }, { x: -2, y: 7 }])
    expect(player().route?.options).toEqual([
      { id: expect.any(String), from: 0, points: [{ x: 1.4, y: 4 }] },
    ])
  })

  it('ignores an option for a player with no route', () => {
    install()
    store.usePlaybook.getState().addPlayerRouteOption('motion-play', 'wr', 0, [{ x: 1, y: 1 }])
    expect(player().route).toBeNull()
  })
})
