import { describe, expect, it } from 'vitest'
import type { Playbook, Player } from '../../types'
import {
  createSnapbookFile,
  parseSnapbook,
  serializeSnapbook,
} from '../files'

const center: Player = {
  id: 'center-id',
  role: 'Center',
  label: 'C',
  number: null,
  color: '#F1EEE4',
  pos: { x: 0, y: 0 },
  route: null,
}

const receiver: Player = {
  id: 'receiver-id',
  role: 'Wide Receiver Left',
  label: 'WR-L',
  number: 11,
  color: '#FF8265',
  pos: { x: -11, y: 0 },
  route: null,
}

const playbook: Playbook = {
  id: 'playbook-id',
  name: 'Demo playbook',
  team: 'Demo team',
  level: '5v5',
  formations: [
    {
      id: 'formation-id',
      name: 'Spread Right',
      players: [center, receiver],
    },
  ],
  categories: [{ id: 'tag-id', name: 'Quick game', color: '#F4C95D' }],
  routes: [
    {
      id: 'library-route-id',
      name: 'Deep Cross',
      group: 'Deep',
      color: '#FF7A59',
      note: 'Cross the far hash.',
      points: [
        { x: 0, y: 4 },
        { x: 8, y: 10, curve: 1.2 },
      ],
    },
    {
      id: 'library-route-two',
      name: 'Settle',
      group: 'Quick game',
      color: '#F4C95D',
      note: '',
      points: [
        { x: 0, y: 5 },
        { x: 1, y: 3.5 },
      ],
    },
  ],
  plays: [
    {
      id: 'play-id',
      name: 'Mesh Right',
      codeName: 'MESH',
      formationId: 'formation-id',
      players: [
        { ...center, id: 'play-center', pos: { ...center.pos } },
        {
          ...receiver,
          id: 'play-receiver',
          label: 'X',
          number: 88,
          pos: { x: -10, y: 1 },
          route: {
            id: 'route-id',
            points: [
              { x: 0, y: 3 },
              { x: 12, y: 4.2, curve: 1 },
            ],
          },
        },
      ],
      categories: ['tag-id'],
      notes: 'Clear the middle with the corner, mesh underneath.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-10-23T12:00:00.000Z',
    },
  ],
}

describe('Snapbook file format', () => {
  it('writes readable names, routes and lineup changes without internal ids', () => {
    const file = createSnapbookFile(playbook, '2026-10-23T12:00:00.000Z')
    const text = JSON.stringify(file)

    expect(file.format).toBe('snapbook')
    expect(file.version).toBe(3)
    expect(file.minReaderVersion).toBe(2)
    expect(file.playbook.name).toBe('Demo playbook')
    expect(file.playbook.tags).toEqual([{ name: 'Quick game', color: '#F4C95D' }])
    expect(file.playbook.routes).toEqual([
      {
        name: 'Deep Cross',
        group: 'Deep',
        color: '#FF7A59',
        note: 'Cross the far hash.',
        points: [
          { x: 0, y: 4 },
          { x: 8, y: 10, curve: 1.2 },
        ],
      },
      {
        name: 'Settle',
        group: 'Quick game',
        color: '#F4C95D',
        points: [
          { x: 0, y: 5 },
          { x: 1, y: 3.5 },
        ],
      },
    ])
    expect(file.playbook.formations[0]).toEqual({
      name: 'Spread Right',
      players: [
        { label: 'C', role: 'Center', color: '#F1EEE4', x: 0, y: 0 },
        {
          label: 'WR-L',
          role: 'Wide Receiver Left',
          number: 11,
          color: '#FF8265',
          x: -11,
          y: 0,
        },
      ],
    })

    const play = file.playbook.plays[0]
    expect(play.formation).toBe('Spread Right')
    expect(play.tags).toEqual(['Quick game'])
    expect(play.routes).toEqual({
      'WR-L': [
        { x: 0, y: 3 },
        { x: 12, y: 4.2, curve: 1 },
      ],
    })
    expect(play.lineup).toEqual({ 'WR-L': { label: 'X', number: 88, x: -10, y: 1 } })
    expect(text).not.toContain('playbook-id')
    expect(text).not.toContain('formation-id')
    expect(text).not.toContain('route-id')
    expect(text).not.toContain('library-route-id')
    expect(text).not.toContain('library-route-two')
  })

  it('round-trips a playbook through serialize and parse', () => {
    const restored = parseSnapbook(serializeSnapbook(playbook, '2026-10-23T12:00:00.000Z'))

    expect(restored.name).toBe('Demo playbook')
    expect(restored.team).toBe('Demo team')
    expect(restored.level).toBe('5v5')
    expect(restored.categories.map((tag) => tag.name)).toEqual(['Quick game'])
    expect(restored.formations[0].name).toBe('Spread Right')
    expect(restored.formations[0].players.map((player) => player.label)).toEqual(['C', 'WR-L'])
    expect(restored.formations[0].players[1].number).toBe(11)
    expect(restored.routes.map((route) => route.name)).toEqual(['Deep Cross', 'Settle'])
    expect(restored.routes[0].group).toBe('Deep')
    expect(restored.routes[0].note).toBe('Cross the far hash.')
    expect(restored.routes[0].points).toEqual([
      { x: 0, y: 4 },
      { x: 8, y: 10, curve: 1.2 },
    ])
    expect(restored.routes[0].id).not.toBe('library-route-id')

    const play = restored.plays[0]
    expect(play.name).toBe('Mesh Right')
    expect(play.codeName).toBe('MESH')
    expect(play.notes).toBe('Clear the middle with the corner, mesh underneath.')
    expect(play.categories).toEqual([restored.categories[0].id])
    expect(play.updatedAt).toBe('2026-10-23T12:00:00.000Z')
    expect(play.players[0].route).toBeNull()
    expect(play.players[1].label).toBe('X')
    expect(play.players[1].number).toBe(88)
    expect(play.players[1].pos).toEqual({ x: -10, y: 1 })
    expect(play.players[1].route?.points).toEqual([
      { x: 0, y: 3 },
      { x: 12, y: 4.2, curve: 1 },
    ])
  })

  it('preserves an intentionally empty route library', () => {
    const restored = parseSnapbook(
      serializeSnapbook({ ...playbook, routes: [] }, '2026-10-23T12:00:00.000Z'),
    )

    expect(restored.routes).toEqual([])
  })

  it('imports v2 files without a route library using the starter routes', () => {
    const file = createSnapbookFile(playbook, '2026-10-23T12:00:00.000Z')
    const older: Record<string, unknown> = {
      ...file,
      version: 2,
      minReaderVersion: 2,
      playbook: { ...file.playbook, routes: undefined },
    }
    delete older.minReaderVersion
    const restored = parseSnapbook(JSON.stringify(older))

    expect(restored.name).toBe('Demo playbook')
    expect(restored.plays[0].players[1].route?.points).toHaveLength(2)
    expect(restored.routes).toHaveLength(18)
    expect(restored.routes.find((route) => route.id === 'hitch')?.name).toBe('Hitch')
  })

  it('still imports the older snapbook.v1 wrapper', () => {
    const legacy = JSON.stringify({
      format: 'snapbook.v1',
      exportedAt: '2026-01-01T00:00:00.000Z',
      app: 'Snapbook',
      playbook,
    })
    expect(parseSnapbook(legacy)).toEqual(playbook)
  })

  it('reads newer additive files that declare compatibility, ignoring unknown fields', () => {
    const file = createSnapbookFile(playbook, '2026-10-23T12:00:00.000Z')
    const future = {
      ...file,
      version: 4,
      minReaderVersion: 2,
      futureHeader: { source: 'a newer app' },
      playbook: {
        ...file.playbook,
        futureMetadata: { audience: 'coaches' },
        formations: file.playbook.formations.map((formation) => ({
          ...formation,
          futureField: true,
          players: formation.players.map((player) => ({ ...player, futureField: true })),
        })),
        plays: file.playbook.plays.map((play) => ({
          ...play,
          futureField: true,
          routes: {
            ...(play.routes ?? {}),
            'WR-L': play.routes?.['WR-L']?.map((point) => ({ ...point, futureField: true })),
          },
        })),
      },
    }

    const restored = parseSnapbook(JSON.stringify(future))
    expect(restored.name).toBe('Demo playbook')
    expect(restored.formations[0].players).toHaveLength(2)
    expect(restored.plays[0].codeName).toBe('MESH')
    expect(restored.plays[0].players[1].route?.points).toEqual([
      { x: 0, y: 3 },
      { x: 12, y: 4.2, curve: 1 },
    ])
  })

  it('rejects files that need a newer reader and malformed files with clear errors', () => {
    const file = createSnapbookFile(playbook)

    expect(() =>
      parseSnapbook(JSON.stringify({ ...file, version: 4, minReaderVersion: 4 })),
    ).toThrow('This Snapbook file needs app version 4 or newer')
    expect(() =>
      parseSnapbook(JSON.stringify({ ...file, version: 4, minReaderVersion: undefined })),
    ).toThrow('This Snapbook file needs app version 4 or newer')
    expect(() =>
      parseSnapbook(JSON.stringify({ ...file, version: 4, minReaderVersion: '2' })),
    ).toThrow('Unsupported Snapbook minimum reader version: 2.')
    expect(() =>
      parseSnapbook(JSON.stringify({ ...file, version: 4, minReaderVersion: 5 })),
    ).toThrow('The Snapbook compatibility metadata is inconsistent.')
    expect(() =>
      parseSnapbook(JSON.stringify({ format: 'snapbook.v2', version: 2, playbook })),
    ).toThrow('Unsupported Snapbook file format: snapbook.v2.')

    const futureLevel = {
      ...file,
      playbook: { ...file.playbook, level: '9v9' },
    }
    expect(() => parseSnapbook(JSON.stringify(futureLevel))).toThrow(
      'unsupported field size “9v9”',
    )

    const broken = {
      ...file,
      playbook: {
        ...file.playbook,
        plays: [{ ...file.playbook.plays[0], tags: ['Missing tag'] }],
      },
    }
    expect(() => parseSnapbook(JSON.stringify(broken))).toThrow(
      'Play “Mesh Right” uses the unknown tag “Missing tag”.',
    )

    const brokenRoute = {
      ...file,
      playbook: {
        ...file.playbook,
        routes: [{ ...file.playbook.routes[0], points: [] }],
      },
    }
    expect(() => parseSnapbook(JSON.stringify(brokenRoute))).toThrow(
      'Route “Deep Cross” has no points.',
    )
    expect(() => parseSnapbook('{')).toThrow('That file is not valid JSON.')
  })
})
