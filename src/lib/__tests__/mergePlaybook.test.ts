import { describe, expect, it } from 'vitest'
import { mergeSharedPlaybook } from '../mergePlaybook'
import {
  category,
  formation,
  play,
  player,
  playbook,
  point,
  route,
} from './snapbookTestUtils'
import type { Player } from '../../types'

const lineup = (): Player[] => [
  player({ role: 'Center', label: 'C', pos: { x: 0, y: 0 } }),
  player({ role: 'Quarterback', label: 'QB', pos: { x: 0, y: -4.5 } }),
  player({ role: 'Wide Receiver Right', label: 'WR-R', pos: { x: 11, y: 0 } }),
]

const ids = (book: {
  formations: Array<{ id: string; players: Array<{ id: string }> }>
  routes: Array<{ id: string }>
  categories: Array<{ id: string }>
  plays: Array<{ id: string; players: Array<{ id: string }> }>
}) => [
  ...book.formations.flatMap((formation) => [
    formation.id,
    ...formation.players.map((entry) => entry.id),
  ]),
  ...book.routes.map((entry) => entry.id),
  ...book.categories.map((entry) => entry.id),
  ...book.plays.flatMap((entry) => [entry.id, ...entry.players.map((item) => item.id)]),
]

describe('mergeSharedPlaybook', () => {
  it('adds all shared content to an empty playbook with fresh ids', () => {
    const sharedTag = category('Quick game', '#F4C95D')
    const sharedFormation = formation('Trips Right', lineup())
    const sharedRoute = route(
      'shared-route',
      'Slash',
      'Quick game',
      '#F4C95D',
      [point(0, 2), point(4, 5)],
      'Break inside.',
    )
    const sharedPlay = play('Mesh', sharedFormation.id, lineup(), {
      codeName: 'MESH',
      categories: [sharedTag.id],
      notes: 'Read the flat defender.',
    })
    const shared = playbook({
      name: 'Shared book',
      team: 'Away team',
      formations: [sharedFormation],
      categories: [sharedTag],
      routes: [sharedRoute],
      plays: [sharedPlay],
    })
    const target = playbook({
      name: 'My playbook',
      team: 'Home team',
      formations: [],
      categories: [],
      routes: [],
      plays: [],
    })

    const result = mergeSharedPlaybook(target, shared)

    expect(result.playbook.name).toBe('My playbook')
    expect(result.playbook.team).toBe('Home team')
    expect(result.playbook.formations).toHaveLength(1)
    expect(result.playbook.categories).toHaveLength(1)
    expect(result.playbook.routes).toHaveLength(1)
    expect(result.playbook.plays).toHaveLength(1)
    expect(result.playbook.plays[0].name).toBe('Mesh')
    expect(result.playbook.plays[0].codeName).toBe('MESH')
    expect(result.playbook.plays[0].notes).toBe('Read the flat defender.')
    expect(result.playbook.plays[0].formationId).toBe(result.playbook.formations[0].id)
    expect(result.playbook.plays[0].categories).toEqual([
      result.playbook.categories[0].id,
    ])
    expect(result.playbook.routes[0].name).toBe('Slash')
    expect(result.added).toEqual({
      plays: 1,
      formations: 1,
      routes: 1,
      tags: 1,
    })

    expect(result.playbook.plays[0].players[0].id).not.toBe(
      sharedPlay.players[0].id,
    )
    expect(result.playbook.plays[0].players[0].route).toBeNull()
  })

  it('reuses matching formations, tags and routes and keeps local plays', () => {
    const targetTag = category('Quick game', '#111111')
    const targetFormation = formation('Spread Right', lineup())
    const targetRoute = route(
      'local-route',
      'Slash',
      'Quick game',
      '#111111',
      [point(0, 2)],
    )
    const targetPlay = play('Smash', targetFormation.id, lineup(), {
      categories: [targetTag.id],
    })
    const target = playbook({
      formations: [targetFormation],
      categories: [targetTag],
      routes: [targetRoute],
      plays: [targetPlay],
    })

    const sharedTag = category('quick GAME', '#999999')
    const sharedFormation = formation('Spread Right', lineup())
    const sharedRoute = route(
      'shared-route',
      'Slash',
      'Quick game',
      '#999999',
      [point(0, 2)],
    )
    const sharedPlay = play('Mesh', sharedFormation.id, lineup(), {
      categories: [sharedTag.id],
    })
    const shared = playbook({
      formations: [sharedFormation],
      categories: [sharedTag],
      routes: [sharedRoute],
      plays: [sharedPlay],
    })

    const result = mergeSharedPlaybook(target, shared)
    const mergedPlay = result.playbook.plays[1]

    expect(result.playbook.formations).toHaveLength(1)
    expect(result.playbook.categories).toHaveLength(1)
    expect(result.playbook.routes).toHaveLength(1)
    expect(result.playbook.plays[0]).toBe(targetPlay)
    expect(mergedPlay.name).toBe('Mesh')
    expect(mergedPlay.formationId).toBe(targetFormation.id)
    expect(mergedPlay.categories).toEqual([targetTag.id])
    expect(result.added).toEqual({
      plays: 1,
      formations: 0,
      routes: 0,
      tags: 0,
    })
  })

  it('skips exact duplicate plays even when their local ids differ', () => {
    const localTag = category('Quick game', '#111111')
    const localFormation = formation('Spread Right', lineup())
    const routed = (routeId: string): Player[] => [
      player({
        role: 'Center',
        label: 'C',
        pos: { x: 0, y: 0 },
      }),
      player({
        role: 'Quarterback',
        label: 'QB',
        pos: { x: 0, y: -4.5 },
        route: { id: routeId, points: [point(0, 2, 0.5), point(4, 5)] },
      }),
    ]
    const localPlay = play('Mesh', localFormation.id, routed('local-route'), {
      codeName: 'MESH',
      notes: 'Same coaching note.',
      categories: [localTag.id],
    })
    const target = playbook({
      formations: [localFormation],
      categories: [localTag],
      plays: [localPlay],
    })

    const sharedTag = category('Quick game', '#999999')
    const sharedFormation = formation('Spread Right', lineup())
    const sharedPlay = play('Mesh', sharedFormation.id, routed('shared-route'), {
      codeName: 'MESH',
      notes: 'Same coaching note.',
      categories: [sharedTag.id],
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    const shared = playbook({
      formations: [sharedFormation],
      categories: [sharedTag],
      plays: [sharedPlay],
    })

    const result = mergeSharedPlaybook(target, shared)

    expect(result.playbook.plays).toHaveLength(1)
    expect(result.playbook.plays[0]).toBe(localPlay)
    expect(result.added).toEqual({
      plays: 0,
      formations: 0,
      routes: 0,
      tags: 0,
    })
    expect(result.skipped).toBe(1)

    const again = mergeSharedPlaybook(result.playbook, shared)
    expect(again.playbook.plays).toHaveLength(1)
    expect(again.skipped).toBe(1)
  })

  it('keeps differently shaped content and renames only the collisions', () => {
    const targetTag = category('Quick game', '#111111')
    const targetFormation = formation('Spread Right', [
      player({ role: 'Center', label: 'C', pos: { x: 1, y: 0 } }),
    ])
    const targetRoute = route(
      'local-route',
      'Slash',
      'Quick game',
      '#111111',
      [point(0, 2)],
    )
    const target = playbook({
      formations: [targetFormation],
      categories: [targetTag],
      routes: [targetRoute],
      plays: [play('Mesh', targetFormation.id, targetFormation.players)],
    })

    const sharedTag = category('Red zone', '#FF8265')
    const sharedFormation = formation('Spread Right', [
      player({ role: 'Center', label: 'C', pos: { x: 2, y: 0 } }),
    ])
    const sharedRoute = route(
      'shared-route',
      'Slash',
      'Quick game',
      '#222222',
      [point(0, 5)],
    )
    const sharedPlay = play('Mesh', sharedFormation.id, sharedFormation.players, {
      categories: [sharedTag.id],
    })
    const shared = playbook({
      formations: [sharedFormation],
      categories: [sharedTag],
      routes: [sharedRoute],
      plays: [sharedPlay],
    })

    const result = mergeSharedPlaybook(target, shared)
    const mergedPlay = result.playbook.plays[1]
    const addedFormation = result.playbook.formations[1]
    const addedRoute = result.playbook.routes[1]

    expect(result.playbook.formations).toHaveLength(2)
    expect(addedFormation.name).toBe('Spread Right (shared)')
    expect(mergedPlay.name).toBe('Mesh (shared)')
    expect(mergedPlay.formationId).toBe(addedFormation.id)
    expect(result.playbook.routes).toHaveLength(2)
    expect(addedRoute.name).toBe('Slash (shared)')
    expect(result.playbook.categories).toHaveLength(2)
    expect(mergedPlay.categories).toEqual([result.playbook.categories[1].id])
    expect(result.added).toEqual({
      plays: 1,
      formations: 1,
      routes: 1,
      tags: 1,
    })
  })

  it('never reuses an id from either side', () => {
    const targetFormation = formation('Spread Right', lineup())
    const target = playbook({
      formations: [targetFormation],
      categories: [category('Quick game', '#111111')],
      routes: [route('target-route', 'Slash', 'Quick game', '#111111', [point(0, 2)])],
      plays: [play('Mesh', targetFormation.id, lineup())],
    })
    const sharedFormation = formation('Trips Right', lineup())
    const shared = playbook({
      formations: [sharedFormation],
      categories: [category('Red zone', '#FF8265')],
      routes: [route('shared-route', 'Slash', 'Quick game', '#FF8265', [point(0, 4)])],
      plays: [play('Mesh', sharedFormation.id, lineup())],
    })

    const result = mergeSharedPlaybook(target, shared)
    const existingIds = new Set(ids(target))
    const addedIds = ids(result.playbook).filter((id) => !existingIds.has(id))

    expect(new Set(ids(result.playbook)).size).toBe(ids(result.playbook).length)
    expect(ids(shared).some((id) => addedIds.includes(id))).toBe(false)
  })
})
