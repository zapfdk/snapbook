import { describe, expect, it } from 'vitest'
import type { LibraryRoute, Play, Playbook, Player } from '../../types'
import { playsUsingFormation, playsUsingRoute } from '../usage'

const player = (id: string, label: string, pos: { x: number; y: number }, points = null as
  | { x: number; y: number; curve?: number }[]
  | null): Player => ({
  id,
  role: label,
  label,
  number: 11,
  color: '#FF8265',
  pos,
  route: points?.length ? { id: `${id}-route`, points } : null,
})

const play = (id: string, formationId: string, players: Player[]): Play => ({
  id,
  name: id,
  codeName: '',
  formationId,
  players,
  categories: [],
  notes: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})

const post: LibraryRoute = {
  id: 'post',
  name: 'Post',
  group: 'Deep',
  color: '#82B7FF',
  note: '',
  points: [
    { x: 0, y: 4 },
    { x: 5, y: 14, curve: 0.6 },
  ],
}

const slant: LibraryRoute = {
  id: 'slant',
  name: 'Slant',
  group: 'Quick game',
  color: '#F4C95D',
  note: '',
  points: [{ x: 5, y: 4 }],
}

const spread = (id: string, left: Player, right: Player, formationId = 'spread'): Play =>
  play(id, formationId, [left, right])

const playbook = (plays: Play[]): Playbook => ({
  id: 'book',
  name: 'Test book',
  team: '',
  level: '5v5',
  formations: [],
  plays,
  categories: [],
  routes: [post, slant],
})

describe('plays that use a formation', () => {
  it('lists the plays built from it', () => {
    const book = playbook([
      spread('one', player('l1', 'WR-L', { x: -11, y: 0 }), player('r1', 'WR-R', { x: 11, y: 0 })),
      spread(
        'two',
        player('l2', 'WR-L', { x: -11, y: 0 }),
        player('r2', 'WR-R', { x: 11, y: 0 }),
        'trips',
      ),
    ])

    expect(playsUsingFormation(book, 'spread').map((entry) => entry.name)).toEqual(['one'])
    expect(playsUsingFormation(book, 'trips').map((entry) => entry.name)).toEqual(['two'])
    expect(playsUsingFormation(book, 'empty')).toEqual([])
  })
})

describe('plays that use a library route', () => {
  it('finds a route applied to the receiver it was drawn for', () => {
    const book = playbook([
      spread(
        'mirror',
        player('l', 'WR-L', { x: -11, y: 0 }, post.points),
        player('r', 'WR-R', { x: 11, y: 0 }),
      ),
    ])

    expect(playsUsingRoute(book, post)).toHaveLength(1)
    expect(playsUsingRoute(book, post)[0].labels).toEqual(['WR-L'])
  })

  it('matches a route mirrored for the other side, and flipped back', () => {
    const mirrored = post.points.map((point) => ({
      ...point,
      x: -point.x,
      ...(point.curve ? { curve: -point.curve } : {}),
    }))
    const book = playbook([
      spread(
        'right',
        player('l', 'WR-L', { x: -11, y: 0 }),
        player('r', 'WR-R', { x: 11, y: 0 }, mirrored),
      ),
    ])

    const usage = playsUsingRoute(book, post)
    expect(usage).toHaveLength(1)
    expect(usage[0].labels).toEqual(['WR-R'])
  })

  it('names every receiver running the same route in one play', () => {
    const book = playbook([
      spread(
        'both',
        player('l', 'WR-L', { x: -11, y: 0 }, post.points),
        player('r', 'WR-R', { x: 11, y: 0 }, post.points),
      ),
    ])

    expect(playsUsingRoute(book, post)[0].labels).toEqual(['WR-L', 'WR-R'])
  })

  it('ignores a route that was reshaped by hand, and a different route', () => {
    const book = playbook([
      spread(
        'edited',
        player('l', 'WR-L', { x: -11, y: 0 }, [{ x: 0, y: 4 }, { x: 4, y: 12 }]),
        player('r', 'WR-R', { x: 11, y: 0 }, slant.points),
      ),
    ])

    expect(playsUsingRoute(book, post)).toEqual([])
    expect(playsUsingRoute(book, slant).map((entry) => entry.play.name)).toEqual(['edited'])
  })

  it('ignores a receiver with no route', () => {
    const book = playbook([
      spread('empty', player('l', 'WR-L', { x: -11, y: 0 }), player('r', 'WR-R', { x: 11, y: 0 })),
    ])

    expect(playsUsingRoute(book, post)).toEqual([])
  })
})
