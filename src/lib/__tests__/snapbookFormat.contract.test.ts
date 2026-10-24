import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import {
  SNAPBOOK_FORMAT,
  SNAPBOOK_MIN_READER_VERSION,
  SNAPBOOK_READER_VERSION,
  SNAPBOOK_VERSION,
  createSnapbookFile,
  parseSnapbook,
  serializeSnapbook,
} from '../files'
import {
  category,
  fixtureFile,
  fixtureNames,
  fixtureText,
  formation,
  goldenText,
  parseFixture,
  play,
  playbook,
  player,
  route,
  point,
} from './snapbookTestUtils'

const exportedAt = '2026-10-24T00:00:00.000Z'

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys)
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key)
      collectKeys(entry, keys)
    }
  }
  return keys
}

function keyOrder(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.keys(value)
}

describe('Snapbook format contract', () => {
  it('pins the writer revision and compatibility header', () => {
    expect(SNAPBOOK_FORMAT).toBe('snapbook')
    expect(SNAPBOOK_VERSION).toBe(3)
    expect(SNAPBOOK_READER_VERSION).toBe(3)
    expect(SNAPBOOK_MIN_READER_VERSION).toBe(2)

    const file = createSnapbookFile(playbook(), exportedAt)
    expect(keyOrder(file)).toEqual([
      'format',
      'version',
      'minReaderVersion',
      'exportedAt',
      'playbook',
    ])
    expect(file.format).toBe('snapbook')
    expect(file.version).toBe(3)
    expect(file.minReaderVersion).toBe(2)
    expect(file.exportedAt).toBe(exportedAt)
  })

  it('writes the canonical v3 export byte-for-byte from native playbook data', () => {
    const spread = formation('Spread Right', [
      player({
        id: 'spread-c',
        role: 'Center',
        label: 'C',
        number: null,
        color: '#F1EEE4',
        pos: { x: 0, y: 0 },
      }),
      player({
        id: 'spread-qb',
        role: 'Quarterback',
        label: 'QB',
        number: 7,
        color: '#F4C95D',
        pos: { x: 0, y: -4.5 },
      }),
      player({
        id: 'spread-wrl',
        role: 'Wide Receiver Left',
        label: 'WR-L',
        number: 11,
        color: '#FF8265',
        pos: { x: -11.123, y: 0.004 },
      }),
      player({
        id: 'spread-wrr',
        role: 'Wide Receiver Right',
        label: 'WR-R',
        number: 88,
        color: '#64D8C4',
        pos: { x: 10.996, y: -0.004 },
      }),
      player({
        id: 'spread-hb',
        role: 'Halfback',
        label: 'HB',
        number: null,
        color: '#B09CFF',
        pos: { x: 4, y: -2 },
      }),
    ])
    const trips = formation('Trips Right', [
      player({
        id: 'trips-c',
        role: 'Center',
        label: 'C',
        number: null,
        color: '#F1EEE4',
        pos: { x: 0, y: 0 },
      }),
      player({
        id: 'trips-qb',
        role: 'Quarterback',
        label: 'QB',
        number: 7,
        color: '#F4C95D',
        pos: { x: 0, y: -4.5 },
      }),
      player({
        id: 'trips-wrl',
        role: 'Wide Receiver Left',
        label: 'WR-L',
        number: 11,
        color: '#FF8265',
        pos: { x: -11, y: 0 },
      }),
      player({
        id: 'trips-wrr',
        role: 'Wide Receiver Right',
        label: 'WR-R',
        number: 88,
        color: '#64D8C4',
        pos: { x: 11, y: 0 },
      }),
      player({
        id: 'trips-slot',
        role: 'Slot Receiver',
        label: 'SLOT',
        number: null,
        color: '#82B7FF',
        pos: { x: 6, y: -1 },
      }),
    ])

    const clone = (entry: Player): Player => ({
      ...entry,
      id: `${entry.id}-play`,
      pos: { ...entry.pos },
      route: null,
    })
    const meshPlayers = spread.players.map(clone)
    meshPlayers[0].route = { id: 'mesh-c', points: [point(0, 3)] }
    meshPlayers[2] = {
      ...meshPlayers[2],
      label: 'X',
      role: 'X Receiver',
      number: 88,
      color: '#F08EC0',
      pos: { x: -10.25, y: 0.75 },
      route: { id: 'mesh-wrl', points: [point(0, 3), point(12, 4.2, 1)] },
    }
    meshPlayers[3] = {
      ...meshPlayers[3],
      number: null,
      route: { id: 'mesh-wrr', points: [point(0, 2), point(8, 3, 0.6)] },
    }
    meshPlayers[4] = {
      ...meshPlayers[4],
      label: 'H',
      route: { id: 'mesh-hb', points: [point(0, 4)] },
    }

    const floodPlayers = trips.players.map(clone)
    floodPlayers[0].route = { id: 'flood-c', points: [point(0, 2)] }
    floodPlayers[1] = {
      ...floodPlayers[1],
      number: null,
      pos: { x: 0.5, y: -4 },
    }
    floodPlayers[3].route = { id: 'flood-wrr', points: [point(0, 9)] }
    floodPlayers[4].route = {
      id: 'flood-slot',
      points: [point(-2, 2, -1.2), point(-2, 12)],
    }

    const quickGame = category('Quick game', '#F4C95D')
    const deepShots = category('Deep shots', '#FF7A59')
    const book = playbook({
      name: 'Friday Night',
      team: 'Hawks',
      level: '5v5',
      categories: [quickGame, deepShots],
      routes: [
        route(
          'library-deep-cross',
          'Deep Cross',
          'Deep',
          '#FF7A59',
          [point(0, 4), point(8, 10, 1.2)],
          'Cross the far hash.',
        ),
        route('library-settle', 'Settle', 'Quick game', '#F4C95D', [
          point(0, 5),
          point(1, 3.5),
        ]),
        route(
          'library-wheel',
          'Wheel',
          'Deep',
          '#FF7A59',
          [point(-2, 2, -1.2), point(-2, 12)],
          'Climb the sideline.',
        ),
      ],
      formations: [spread, trips],
      plays: [
        play('Mesh Right', spread.id, meshPlayers, {
          codeName: 'MESH',
          categories: [quickGame.id],
          notes: 'Clear the middle with the corner, mesh underneath.',
          updatedAt: '2026-10-23T12:00:00.000Z',
        }),
        play('Four Verticals', spread.id, spread.players.map(clone), {
          updatedAt: '2026-10-22T09:30:00.000Z',
        }),
        play('Trips Flood', trips.id, floodPlayers, {
          codeName: 'FLOOD',
          categories: [deepShots.id, quickGame.id],
          updatedAt: '2026-10-21T18:15:00.000Z',
        }),
      ],
    })

    expect(serializeSnapbook(book, exportedAt)).toBe(goldenText['v3-complete'])
  })

  it('writes the canonical v3 export byte-for-byte after an import', () => {
    const restored = parseFixture('v3-complete')
    expect(serializeSnapbook(restored, exportedAt)).toBe(goldenText['v3-complete'])
  })

  it('writes the intentionally empty route library byte-for-byte as committed', () => {
    const restored = parseFixture('v3-empty-route-library')
    expect(serializeSnapbook(restored, exportedAt)).toBe(
      goldenText['v3-empty-route-library'],
    )
  })

  it('does not leak local ids, creation timestamps or null placeholders', () => {
    const text = serializeSnapbook(parseFixture('v3-complete'), exportedAt)
    const keys = collectKeys(JSON.parse(text))

    expect(keys).not.toContain('id')
    expect(keys).not.toContain('createdAt')
    expect(text).not.toContain('playbook-fixture')
    expect(text).not.toContain('library-deep-cross')
    expect(text).not.toContain('play-mesh')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('serializes every valid fixture without leaking implementation-only fields', () => {
    for (const name of fixtureNames.filter((entry) => !entry.startsWith('v1-'))) {
      const file = fixtureFile(name)
      const text = serializeSnapbook(parseSnapbook(fixtureText[name]), exportedAt)
      const keys = collectKeys(JSON.parse(text))

      expect(file.format, name).toBe('snapbook')
      expect(keys, name).not.toContain('id')
      expect(keys, name).not.toContain('createdAt')
      expect(text.endsWith('\n'), name).toBe(true)
    }
  })

  it('normalizes names, coordinates, player keys and optional values on export', () => {
    const spread = formation('  Spread  ', [
      player({
        id: 'center',
        role: 'Center',
        label: 'C',
        number: null,
        color: '#F1EEE4',
        pos: { x: 0, y: 0 },
      }),
      player({
        id: 'wr-one',
        role: 'Wide Receiver Left',
        label: 'WR',
        number: 11,
        pos: { x: -11.126, y: 0.004 },
      }),
      player({
        id: 'wr-two',
        role: 'Wide Receiver Right',
        label: 'WR',
        number: 88,
        pos: { x: 10.996, y: 0.004 },
      }),
    ])
    const book = playbook({
      categories: [
        category('  Quick game  ', '#F4C95D'),
        category('quick GAME', '#FF7A59'),
        category('', '#64D8C4'),
      ],
      routes: [
        route(
          'deep-cross',
          '  Deep Cross  ',
          'Deep',
          '#FF7A59',
          [point(0, 4), point(8.004, 10.004, 0)],
          '   ',
        ),
        route('deep-cross-two', 'deep cross', 'Intermediate', '#82B7FF', [point(0, 5)]),
        route('', '', 'Deep', '#FF7A59', [point(0, 6), point(1, 12)]),
      ],
      formations: [spread],
      plays: [
        play(
          ' Mesh ',
          spread.id,
          [
            {
              ...spread.players[0],
              id: 'play-center',
              label: 'C',
              number: null,
              pos: { x: 0, y: 0 },
            },
            {
              ...spread.players[1],
              id: 'play-wr-one',
              label: 'X',
              number: 88,
              color: '#F08EC0',
              pos: { x: -10.25, y: 0.75 },
              route: { id: 'route-one', points: [point(0, 3), point(12, 4.2, 1)] },
            },
            {
              ...spread.players[2],
              id: 'play-wr-two',
              number: null,
              pos: { x: 11.002, y: 0 },
              route: { id: 'route-two', points: [point(0, 2)] },
            },
          ],
          {
            codeName: '',
            categories: ['unused'],
            notes: '   ',
            updatedAt: '2026-10-23T12:00:00.000Z',
          },
        ),
      ],
    })
    const file = createSnapbookFile(book, exportedAt)

    expect(file.playbook.tags).toEqual([
      { name: 'Quick game', color: '#F4C95D' },
      { name: 'quick GAME (2)', color: '#FF7A59' },
      { name: 'Tag 3', color: '#64D8C4' },
    ])
    expect(file.playbook.formations[0].name).toBe('Spread')
    expect(file.playbook.formations[0].players).toEqual([
      { label: 'C', role: 'Center', color: '#F1EEE4', x: 0, y: 0 },
      {
        label: 'WR',
        role: 'Wide Receiver Left',
        number: 11,
        color: '#FF8265',
        x: -11.13,
        y: 0,
      },
      {
        label: 'WR',
        role: 'Wide Receiver Right',
        number: 88,
        color: '#FF8265',
        x: 11,
        y: 0,
      },
    ])
    expect(file.playbook.routes).toEqual([
      {
        name: 'Deep Cross',
        group: 'Deep',
        color: '#FF7A59',
        points: [{ x: 0, y: 4 }, { x: 8, y: 10 }],
      },
      {
        name: 'deep cross (2)',
        group: 'Intermediate',
        color: '#82B7FF',
        points: [{ x: 0, y: 5 }],
      },
      {
        name: 'Route 3',
        group: 'Deep',
        color: '#FF7A59',
        points: [
          { x: 0, y: 6 },
          { x: 1, y: 12 },
        ],
      },
    ])

    const exportedPlay = file.playbook.plays[0]
    expect(exportedPlay).toEqual({
      name: ' Mesh ',
      formation: 'Spread',
      updatedAt: '2026-10-23T12:00:00.000Z',
      routes: {
        WR: [{ x: 0, y: 3 }, { x: 12, y: 4.2, curve: 1 }],
        'WR #2': [{ x: 0, y: 2 }],
      },
      lineup: {
        WR: { label: 'X', number: 88, color: '#F08EC0', x: -10.25, y: 0.75 },
        'WR #2': { number: null },
      },
    })
  })

  it('is deterministic for a fixed export timestamp', () => {
    const first = serializeSnapbook(parseFixture('v3-complete'), exportedAt)
    const second = serializeSnapbook(parseFixture('v3-complete'), exportedAt)
    const later = serializeSnapbook(parseFixture('v3-complete'), '2026-10-25T00:00:00.000Z')

    expect(first).toBe(second)
    expect(later.replace('2026-10-25T00:00:00.000Z', exportedAt)).toBe(first)
  })

  it('rejects plays whose formation or lineup cannot be exported', () => {
    const spread = formation('Spread', [player({ label: 'C' })])
    const missingFormation = playbook({
      formations: [spread],
      plays: [play('Ghost', 'missing-formation', [player({ label: 'C' })])],
    })
    expect(() => createSnapbookFile(missingFormation, exportedAt)).toThrow(
      'Cannot export “Ghost”: its formation is missing.',
    )

    const mismatched = playbook({
      formations: [spread],
      plays: [
        play('Short lineup', spread.id, [
          player({ label: 'C' }),
          player({ label: 'QB' }),
        ]),
      ],
    })
    expect(() => createSnapbookFile(mismatched, exportedAt)).toThrow(
      'Cannot export “Short lineup”: its lineup does not match “Spread”.',
    )
  })

  it('does not preserve fields it does not understand when re-exporting', () => {
    const future = parseFixture('v4-additive')
    const text = serializeSnapbook(future, exportedAt)

    expect(text).toBe(goldenText['v3-complete'])
    expect(text).not.toContain('futureField')
    expect(text).not.toContain('futureMetadata')
    expect(text).not.toContain('futureHeader')
  })
})
