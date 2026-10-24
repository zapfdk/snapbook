import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE_LIBRARY } from '../../data/routeLibrary'
import {
  SNAPBOOK_READER_VERSION,
  parseSnapbook,
  serializeSnapbook,
} from '../files'
import {
  fixtureNames,
  fixtureText,
  mutateFixture,
  parseFixture,
  semantics,
  type JsonObject,
} from './snapbookTestUtils'

const exportedAt = '2026-10-24T00:00:00.000Z'

const object = (value: unknown): JsonObject => value as JsonObject
const list = (value: unknown): JsonObject[] => value as JsonObject[]

function withoutRoutes(book: ReturnType<typeof semantics>) {
  const { routes: _routes, ...rest } = book
  return rest
}

describe('Snapbook import compatibility', () => {
  it('reads the canonical v3 fixture with all documented semantics intact', () => {
    const book = parseFixture('v3-complete')

    expect(book.name).toBe('Friday Night')
    expect(book.team).toBe('Hawks')
    expect(book.level).toBe('5v5')
    expect(book.categories.map((entry) => [entry.name, entry.color])).toEqual([
      ['Quick game', '#F4C95D'],
      ['Deep shots', '#FF7A59'],
    ])
    expect(book.routes.map((entry) => entry.name)).toEqual(['Deep Cross', 'Settle', 'Wheel'])
    expect(book.routes[0]).toMatchObject({
      group: 'Deep',
      color: '#FF7A59',
      note: 'Cross the far hash.',
      points: [
        { x: 0, y: 4 },
        { x: 8, y: 10, curve: 1.2 },
      ],
    })
    expect(book.routes[1].note).toBe('')

    expect(book.formations.map((entry) => entry.name)).toEqual(['Spread Right', 'Trips Right'])
    expect(book.formations[0].players.map((entry) => entry.label)).toEqual([
      'C',
      'QB',
      'WR-L',
      'WR-R',
      'HB',
    ])
    expect(book.formations[0].players[2]).toMatchObject({
      role: 'Wide Receiver Left',
      number: 11,
      color: '#FF8265',
      pos: { x: -11.12, y: 0 },
      route: null,
    })

    const mesh = book.plays[0]
    const formationNames = new Map(book.formations.map((entry) => [entry.id, entry.name]))
    const tagNames = new Map(book.categories.map((entry) => [entry.id, entry.name]))
    expect(mesh.name).toBe('Mesh Right')
    expect(mesh.codeName).toBe('MESH')
    expect(formationNames.get(mesh.formationId)).toBe('Spread Right')
    expect(mesh.categories.map((id) => tagNames.get(id))).toEqual(['Quick game'])
    expect(mesh.notes).toBe('Clear the middle with the corner, mesh underneath.')
    expect(mesh.updatedAt).toBe('2026-10-23T12:00:00.000Z')
    expect(mesh.createdAt).toBe(mesh.updatedAt)
    expect(mesh.players[2]).toMatchObject({
      label: 'X',
      role: 'X Receiver',
      number: 88,
      color: '#F08EC0',
      pos: { x: -10.25, y: 0.75 },
    })
    expect(mesh.players[2].route?.points).toEqual([
      { x: 0, y: 3 },
      { x: 12, y: 4.2, curve: 1 },
    ])
    expect(mesh.players[3]).toMatchObject({ label: 'WR-R', number: null })
    expect(mesh.players[3].route?.points).toEqual([
      { x: 0, y: 2 },
      { x: 8, y: 3, curve: 0.6 },
    ])
    expect(mesh.players[4]).toMatchObject({ label: 'H', role: 'Halfback' })
    expect(mesh.players[4].route?.points).toEqual([{ x: 0, y: 4 }])

    expect(book.plays[1]).toMatchObject({
      name: 'Four Verticals',
      codeName: '',
      categories: [],
      notes: '',
    })
    expect(book.plays[1].players.every((entry) => entry.route === null)).toBe(true)

    const flood = book.plays[2]
    expect(flood.players[1]).toMatchObject({
      label: 'QB',
      number: null,
      pos: { x: 0.5, y: -4 },
    })
    expect(flood.categories.map((id) => tagNames.get(id))).toEqual([
      'Deep shots',
      'Quick game',
    ])
  })

  it('imports every committed valid fixture', () => {
    for (const name of fixtureNames) {
      const book = parseSnapbook(fixtureText[name])
      expect(book.name, name).toBeTruthy()
      expect(book.formations.length, name).toBeGreaterThan(0)
      expect(book.plays.length, name).toBeGreaterThanOrEqual(0)
    }
  })

  it('treats v2 and v3 files without a route library as the starter library', () => {
    for (const name of ['v2-no-route-library', 'v3-minimal-no-routes'] as const) {
      const book = parseFixture(name)
      expect(book.routes, name).toHaveLength(18)
      expect(book.routes.map((entry) => entry.name), name).toEqual(
        DEFAULT_ROUTE_LIBRARY.map((entry) => entry.name),
      )
      expect(book.routes[0].id, name).toBe(DEFAULT_ROUTE_LIBRARY[0].id)
    }
  })

  it('preserves an intentionally empty route library', () => {
    expect(parseFixture('v3-empty-route-library').routes).toEqual([])
  })

  it('keeps v2 content identical to v3 apart from the missing route library', () => {
    const v2 = parseFixture('v2-no-route-library')
    const v3 = parseFixture('v3-complete')

    expect(withoutRoutes(semantics(v2))).toEqual(withoutRoutes(semantics(v3)))
    expect(v2.routes.every((entry) => !v3.routes.some((route) => route.id === entry.id))).toBe(
      true,
    )
  })

  it('accepts the same content with an implicit, explicit or newer additive version', () => {
    const expected = semantics(parseFixture('v2-no-route-library'))
    for (const name of [
      'v2-with-min-reader',
      'v3-complete',
      'v3-no-min-reader',
      'v4-additive',
    ] as const) {
      expect(withoutRoutes(semantics(parseFixture(name))), name).toEqual(
        withoutRoutes(expected),
      )
    }
  })

  it('ignores unknown fields at every level while importing known data', () => {
    const restored = parseFixture('v4-additive')

    expect(restored.name).toBe('Friday Night')
    expect(restored.categories[0].name).toBe('Quick game')
    expect(restored.formations[0].players).toHaveLength(5)
    expect(restored.routes).toHaveLength(3)
    expect(restored.plays[0].players[2].route?.points).toHaveLength(2)
    expect(JSON.stringify(restored)).not.toContain('future')
  })

  it('still imports the v1 wrapper and bare legacy playbooks', () => {
    const wrapped = parseFixture('v1-legacy-wrapper')
    expect(wrapped.name).toBe('Legacy Book')
    expect(wrapped.team).toBe('Old Hawks')
    expect(wrapped.categories.map((entry) => entry.name)).toEqual(['Old tag'])
    expect(wrapped.routes).toHaveLength(18)
    expect(wrapped.plays[0].players[0].route?.points).toEqual([{ x: 0, y: 4 }])

    const bare = parseSnapbook(
      JSON.stringify({
        id: 'bare-book',
        name: 'Bare legacy',
        team: '',
        level: '5v5',
        categories: [],
        formations: [],
        plays: [],
      }),
    )
    expect(bare.name).toBe('Bare legacy')
    expect(bare.routes).toHaveLength(18)
  })

  it('accepts a UTF-8 BOM, CRLF line endings and surrounding whitespace', () => {
    const text = fixtureText['v3-complete']
    const crlf = `\uFEFF\r\n${text.replace(/\n/g, '\r\n')}\r\n`

    const restored = parseSnapbook(crlf)
    expect(restored.name).toBe('Friday Night')
    expect(restored.plays).toHaveLength(3)
  })

  it('negotiates versions by minimum reader rather than by writer version alone', () => {
    const futureAdditive = mutateFixture((file) => {
      file.version = SNAPBOOK_READER_VERSION + 2
      file.minReaderVersion = SNAPBOOK_READER_VERSION
    })
    expect(parseSnapbook(futureAdditive).name).toBe('Friday Night')

    const newerMinimum = mutateFixture((file) => {
      file.version = SNAPBOOK_READER_VERSION + 2
      file.minReaderVersion = 2
    })
    expect(parseSnapbook(newerMinimum).name).toBe('Friday Night')

    const oneTooNew = mutateFixture((file) => {
      file.version = SNAPBOOK_READER_VERSION + 2
      file.minReaderVersion = SNAPBOOK_READER_VERSION + 1
    })
    expect(() => parseSnapbook(oneTooNew)).toThrow(
      `This Snapbook file needs app version ${SNAPBOOK_READER_VERSION + 1} or newer`,
    )
  })

  it('applies documented defaults for optional fields', () => {
    const text = mutateFixture((file, book) => {
      delete book.team
      book.level = '7V7'
      const tags = list(book.tags)
      tags[0] = { name: 'Quick game' }
      const routes = list(book.routes)
      routes[0] = { name: 'Loose', points: [{ x: 0, y: 1 }] }
      const formations = list(book.formations)
      const players = list(object(formations[0]).players)
      players[0] = { x: 0, y: 0 }
      const plays = list(book.plays)
      const play = object(plays[0])
      delete play.code
      delete play.tags
      delete play.notes
      delete play.routes
      delete play.lineup
      play.name = 'Sparse play'
      file.minReaderVersion = 2
    })

    const book = parseSnapbook(text)
    expect(book.team).toBe('')
    expect(book.level).toBe('7v7')
    expect(book.categories[0].color).toBe('#F4C95D')
    expect(book.routes[0]).toMatchObject({
      group: 'Intermediate',
      color: '#82B7FF',
      note: '',
    })
    expect(book.formations[0].players[0]).toMatchObject({
      label: '',
      role: '',
      number: null,
      color: '#F1EEE4',
      pos: { x: 0, y: 0 },
    })
    expect(book.plays[0]).toMatchObject({
      name: 'Sparse play',
      codeName: '',
      categories: [],
      notes: '',
    })
    expect(book.plays[0].players.every((entry) => entry.route === null)).toBe(true)
  })

  it('matches tags case-insensitively and removes duplicate tag references', () => {
    const text = mutateFixture((_file, book) => {
      const play = object(list(book.plays)[0])
      play.tags = ['quick GAME', 'Quick Game', 'deep shots']
    })
    const book = parseSnapbook(text)
    const tagNames = new Map(book.categories.map((entry) => [entry.id, entry.name]))

    expect(book.plays[0].categories.map((id) => tagNames.get(id))).toEqual([
      'Quick game',
      'Deep shots',
    ])
  })

  it('round-trips every committed fixture stably after the v3 writer normalizes it', () => {
    for (const name of fixtureNames) {
      const once = serializeSnapbook(parseSnapbook(fixtureText[name]), exportedAt)
      const twice = serializeSnapbook(parseSnapbook(once), exportedAt)
      expect(twice, name).toBe(once)
      expect(object(JSON.parse(once)).format, name).toBe('snapbook')
    }
  })
})
