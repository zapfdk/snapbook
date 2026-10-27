import { describe, expect, it } from 'vitest'
import { parseSnapbook, serializeSnapbook } from '../files'
import {
  category,
  fixtureNames,
  fixtureText,
  formation,
  parseFixture,
  play,
  playbook,
  player,
  randomPlaybook,
  route,
  semantics,
  point,
  type JsonObject,
} from './snapbookTestUtils'

const exportedAt = '2026-10-24T00:00:00.000Z'

describe('Snapbook round-trip stability', () => {
  it('preserves the semantics of the canonical export', () => {
    const original = parseFixture('v3-complete')
    const restored = parseSnapbook(serializeSnapbook(original, exportedAt))

    expect(semantics(restored)).toEqual(semantics(original))
  })

  it('produces stable output when re-exporting every committed fixture', () => {
    for (const name of fixtureNames) {
      const once = serializeSnapbook(parseSnapbook(fixtureText[name]), exportedAt)
      const twice = serializeSnapbook(parseSnapbook(once), exportedAt)
      expect(twice, name).toBe(once)
    }
  })

  it('round-trips Unicode, punctuation and empty optional values', () => {
    const spread = formation('Grüße 🏈', [
      player({ label: '🔥', role: 'Wide Receiver — Links', number: 0, color: '#ABC123' }),
      player({ label: 'QB', role: 'Quarterback', number: 7, color: '#F4C95D' }),
    ])
    const book = playbook({
      name: 'Café “Friday” \\ Night',
      team: '日本語チーム',
      categories: [category('Screens / Quicks', '#64D8C4')],
      routes: [
        route(
          'unicode-route',
          'Tourne à gauche',
          'Intermediate',
          '#82B7FF',
          [point(-0.25, 3.75), point(-0.5, 9.25, -0.75)],
          'Ligne 1\nLigne 2\t"guillemets"',
        ),
      ],
      formations: [spread],
      plays: [
        play('Piège « mesh »', spread.id, [
          {
            ...spread.players[0],
            route: { id: 'route', points: [point(0, 2)] },
          },
          {
            ...spread.players[1],
            label: 'QB2',
            number: 0,
            pos: { x: 0.25, y: -4.75 },
          },
        ], {
          codeName: 'MÉSH',
          categories: [],
          notes: 'Ligne 1\nLigne 2',
          updatedAt: '2026-10-24T01:02:03.004Z',
        }),
      ],
    })

    const restored = parseSnapbook(serializeSnapbook(book, exportedAt))
    expect(semantics(restored)).toEqual(semantics(book))
    expect(restored.name).toBe('Café “Friday” \\ Night')
    expect(restored.team).toBe('日本語チーム')
    expect(restored.plays[0].players[0].label).toBe('🔥')
    expect(restored.plays[0].players[0].number).toBe(0)
  })

  it('normalizes a zero curve to an absent curve without changing meaning', () => {
    const straight = formation('Straight', [
      player({
        label: 'C',
        route: { id: 'route', points: [point(0, 1, 0), point(0, 4, 0)] },
      }),
    ])
    const book = playbook({
      formations: [straight],
      plays: [
        play('Straight', straight.id, [
          {
            ...straight.players[0],
            route: { id: 'play-route', points: [point(0, 1, 0), point(0, 4, 0)] },
          },
        ]),
      ],
    })

    const text = serializeSnapbook(book, exportedAt)
    expect(text).not.toContain('"curve"')
    const restored = parseSnapbook(text)
    expect(restored.plays[0].players[0].route?.points).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 4 },
    ])
    expect(semantics(restored)).toEqual(semantics(book))
  })

  it('round-trips pre-snap motions and option branches', () => {
    const spread = formation('Shift', [player({ label: 'WR' }), player({ label: 'QB' })])
    const book = playbook({
      formations: [spread],
      plays: [
        play('Shift', spread.id, [
          {
            ...spread.players[0],
            route: {
              id: 'route',
              points: [point(0, 3), point(4, 5, 0.5)],
              options: [
                { id: 'option-1', from: 1, points: [point(8, 6), point(10, 9, 0.75)] },
                { id: 'option-2', from: 0, points: [point(-3, 4)] },
              ],
            },
            motion: { id: 'motion', points: [point(-4, 0)] },
          },
          { ...spread.players[1], motion: { id: 'motion-qb', points: [point(1, 0, 0.5)] } },
        ]),
      ],
    })

    const text = serializeSnapbook(book, exportedAt)
    const file = JSON.parse(text) as {
      playbook: {
        plays: Array<{ motions: Record<string, unknown>; optionRoutes: Record<string, unknown> }>
      }
    }
    expect(file.playbook.plays[0].motions).toEqual({
      WR: [{ x: -4, y: 0 }],
      QB: [{ x: 1, y: 0, curve: 0.5 }],
    })
    // The branch is anchored to a route point, so both the index and its own
    // points travel with the route.
    expect(file.playbook.plays[0].optionRoutes).toEqual({
      WR: [
        { from: 1, points: [{ x: 8, y: 6 }, { x: 10, y: 9, curve: 0.75 }] },
        { from: 0, points: [{ x: -3, y: 4 }] },
      ],
    })

    const restored = parseSnapbook(text)
    expect(semantics(restored)).toEqual(semantics(book))
    expect(restored.plays[0].players[0].route?.options).toEqual([
      { id: expect.any(String), from: 1, points: [{ x: 8, y: 6 }, { x: 10, y: 9, curve: 0.75 }] },
      { id: expect.any(String), from: 0, points: [{ x: -3, y: 4 }] },
    ])
    expect(restored.plays[0].players[0].motion?.points).toEqual([{ x: -4, y: 0 }])
    expect(serializeSnapbook(restored, exportedAt)).toBe(text)
  })

  it('drops a branch that no longer has a route point to leave from', () => {
    // A branch beyond the route's points cannot be anchored; the route itself
    // still exports, so the file stays readable.
    const spread = formation('Short', [player({ label: 'WR' })])
    const book = playbook({
      formations: [spread],
      plays: [
        play('Short', spread.id, [
          {
            ...spread.players[0],
            route: {
              id: 'route',
              points: [point(0, 3)],
              options: [
                { id: 'ok', from: 0, points: [point(4, 4)] },
                { id: 'gone', from: 3, points: [point(9, 9)] },
              ],
            },
          },
        ]),
      ],
    })

    const text = serializeSnapbook(book, exportedAt)
    const file = JSON.parse(text) as {
      playbook: { plays: Array<{ optionRoutes: Record<string, unknown> }> }
    }
    expect(file.playbook.plays[0].optionRoutes).toEqual({
      WR: [{ from: 0, points: [{ x: 4, y: 4 }] }],
    })
    expect(
      parseSnapbook(text).plays[0].players[0].route?.options?.map((option) => option.from),
    ).toEqual([0])
  })

  it('renames duplicate and blank identifiers consistently on every export', () => {
    const spread = formation('  Spread  ', [player({ label: 'WR' })])
    const duplicate = formation('spread', [player({ label: 'WR' })])
    const book = playbook({
      categories: [category('', '#F4C95D'), category('Tag 1', '#FF7A59')],
      routes: [
        route('one', '', 'Deep', '#FF7A59', [point(0, 1)]),
        route('two', 'Route 1', 'Deep', '#FF7A59', [point(0, 2)]),
      ],
      formations: [spread, duplicate],
      plays: [
        play('Duplicate formation', duplicate.id, [
          { ...duplicate.players[0], route: { id: 'route', points: [point(0, 3)] } },
        ]),
      ],
    })

    const once = serializeSnapbook(book, exportedAt)
    const file = JSON.parse(once) as { playbook: JsonObject }
    const tags = file.playbook.tags as Array<{ name: string }>
    const routes = file.playbook.routes as Array<{ name: string }>
    const formations = file.playbook.formations as Array<{ name: string }>
    const plays = file.playbook.plays as Array<{ formation: string }>

    expect(tags.map((entry) => entry.name)).toEqual(['Tag 1', 'Tag 1 (2)'])
    expect(routes.map((entry) => entry.name)).toEqual(['Route 1', 'Route 1 (2)'])
    expect(formations.map((entry) => entry.name)).toEqual(['Spread', 'spread (2)'])
    expect(plays[0].formation).toBe('spread (2)')
    expect(serializeSnapbook(parseSnapbook(once), exportedAt)).toBe(once)
  })

  it('uses deterministic player keys when labels collide', () => {
    const spread = formation('Collision', [
      player({ label: 'WR', role: 'Wide Receiver Left' }),
      player({ label: 'WR', role: 'Wide Receiver Right' }),
      player({ label: 'WR', role: 'Slot Receiver' }),
    ])
    const book = playbook({
      formations: [spread],
      plays: [
        play('Collision', spread.id, [
          { ...spread.players[0], route: { id: 'a', points: [point(0, 2)] } },
          { ...spread.players[1], route: { id: 'b', points: [point(0, 3)] } },
          { ...spread.players[2], route: { id: 'c', points: [point(0, 4)] } },
        ]),
      ],
    })

    const file = JSON.parse(serializeSnapbook(book, exportedAt)) as {
      playbook: { plays: Array<{ routes: Record<string, unknown> }> }
    }
    expect(Object.keys(file.playbook.plays[0].routes)).toEqual(['WR', 'WR #2', 'WR #3'])
    expect(semantics(parseSnapbook(serializeSnapbook(book, exportedAt)))).toEqual(
      semantics(book),
    )
  })

  it('keeps player keys unique when a label already looks suffixed', () => {
    const spread = formation('Suffix collision', [
      player({ label: 'WR' }),
      player({ label: 'WR' }),
      player({ label: 'WR #2' }),
    ])
    const book = playbook({
      formations: [spread],
      plays: [
        play('Suffix collision', spread.id, [
          { ...spread.players[0], route: { id: 'a', points: [point(0, 2)] } },
          { ...spread.players[1], route: { id: 'b', points: [point(0, 3)] } },
          { ...spread.players[2], route: { id: 'c', points: [point(0, 4)] } },
        ]),
      ],
    })

    const text = serializeSnapbook(book, exportedAt)
    const file = JSON.parse(text) as {
      playbook: { plays: Array<{ routes: Record<string, unknown> }> }
    }
    expect(Object.keys(file.playbook.plays[0].routes)).toEqual([
      'WR',
      'WR #2',
      'WR #2 #2',
    ])
    expect(semantics(parseSnapbook(text))).toEqual(semantics(book))
  })

  it('round-trips dozens of generated playbooks without drift', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const source = randomPlaybook(seed)
      const text = serializeSnapbook(source, exportedAt)
      const restored = parseSnapbook(text)

      expect(semantics(restored), `seed ${seed}`).toEqual(semantics(source))
      expect(serializeSnapbook(restored, exportedAt), `seed ${seed}`).toBe(text)
    }
  })

  it('does not carry local ids into an imported playbook', () => {
    const original = parseFixture('v3-complete')
    const restored = parseSnapbook(serializeSnapbook(original, exportedAt))
    const originalIds = new Set([
      original.id,
      ...original.formations.flatMap((entry) => [
        entry.id,
        ...entry.players.map((item) => item.id),
      ]),
      ...original.plays.flatMap((entry) => [
        entry.id,
        ...entry.players.map((item) => item.id),
        ...entry.players.flatMap((item) => (item.route ? [item.route.id] : [])),
      ]),
    ])

    expect(originalIds.has(restored.id)).toBe(false)
    for (const id of [
      ...restored.formations.flatMap((entry) => [
        entry.id,
        ...entry.players.map((item) => item.id),
      ]),
      ...restored.plays.flatMap((entry) => [
        entry.id,
        ...entry.players.map((item) => item.id),
        ...entry.players.flatMap((item) => (item.route ? [item.route.id] : [])),
      ]),
    ]) {
      expect(originalIds.has(id)).toBe(false)
    }
  })
})
