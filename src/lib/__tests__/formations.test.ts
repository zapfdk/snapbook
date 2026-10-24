import { describe, expect, it } from 'vitest'
import type { Formation, Play, Playbook, Player } from '../../types'
import {
  applyFormationUpdate,
  cloneFormation,
  cloneFormationPlayers,
  formationUsage,
  uniqueFormationName,
} from '../formations'

const center: Player = {
  id: 'center',
  role: 'Center',
  label: 'C',
  number: 50,
  color: '#F1EEE4',
  pos: { x: 0, y: 0 },
  route: null,
}

const receiver: Player = {
  id: 'receiver',
  role: 'Wide Receiver Left',
  label: 'WR-L',
  number: 11,
  color: '#FF8265',
  pos: { x: -11, y: 0 },
  route: null,
}

const spread: Formation = {
  id: 'spread',
  name: 'Spread Right',
  players: [center, receiver],
}

const other: Formation = {
  id: 'other',
  name: 'Trips Right',
  players: [{ ...center, id: 'other-center' }, { ...receiver, id: 'other-receiver' }],
}

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

const route = {
  id: 'route',
  points: [
    { x: 0, y: 4 },
    { x: 6, y: 9, curve: 0.8 },
  ],
}

const playbook: Playbook = {
  id: 'book',
  name: 'Demo',
  team: '',
  level: '5v5',
  formations: [spread, other],
  categories: [],
  routes: [],
  plays: [
    play('mesh', 'spread', [
      { ...center, id: 'play-center' },
      { ...receiver, id: 'play-receiver', route },
    ]),
    play('trips', 'other', [
      { ...center, id: 'trips-center' },
      { ...receiver, id: 'trips-receiver' },
    ]),
  ],
}

describe('formation library helpers', () => {
  it('counts plays using a formation and creates unique names', () => {
    expect(formationUsage(playbook, 'spread')).toBe(1)
    expect(formationUsage(playbook, 'missing')).toBe(0)
    expect(uniqueFormationName('New formation', [])).toBe('New formation')
    expect(uniqueFormationName('Spread Right', ['Spread Right', 'Spread Right 2'])).toBe(
      'Spread Right 3',
    )
  })

  it('duplicates a formation with a unique name and fresh player ids', () => {
    const copy = cloneFormation(spread, ['Spread Right'])
    expect(copy.id).not.toBe(spread.id)
    expect(copy.name).toBe('Spread Right copy')
    expect(copy.players).toHaveLength(spread.players.length)
    expect(copy.players[0].id).not.toBe(center.id)
    expect(copy.players[1].pos).toEqual(receiver.pos)
    expect(copy.players[1].pos).not.toBe(receiver.pos)
    expect(copy.players[1].route).toBeNull()

    const second = cloneFormation(spread, ['Spread Right', 'Spread Right copy'])
    expect(second.name).toBe('Spread Right copy 2')
  })

  it('clones a lineup with fresh ids and no routes', () => {
    const clones = cloneFormationPlayers([{ ...receiver, route }])
    expect(clones[0].id).not.toBe('receiver')
    expect(clones[0].pos).toEqual(receiver.pos)
    expect(clones[0].pos).not.toBe(receiver.pos)
    expect(clones[0].route).toBeNull()
  })

  it('updates play alignments and labels while preserving routes and identity', () => {
    const updated = applyFormationUpdate(
      playbook,
      'spread',
      {
        name: 'Spread Tight',
        players: [
          { ...center, pos: { x: 0.5, y: -0.5 } },
          { ...receiver, label: 'X', role: 'X Receiver', pos: { x: -9, y: 1 } },
        ],
      },
      '2026-10-24T00:00:00.000Z',
    )

    expect(updated.formations[0].name).toBe('Spread Tight')
    expect(updated.formations[0].players[1].label).toBe('X')
    expect(updated.formations[1]).toBe(other)

    const mesh = updated.plays.find((item) => item.id === 'mesh')!
    expect(mesh.players[0].pos).toEqual({ x: 0.5, y: -0.5 })
    expect(mesh.players[1].label).toBe('X')
    expect(mesh.players[1].role).toBe('X Receiver')
    expect(mesh.players[1].pos).toEqual({ x: -9, y: 1 })
    expect(mesh.players[1].route).toEqual(route)
    expect(mesh.players[1].number).toBe(11)
    expect(mesh.players[1].color).toBe('#FF8265')
    expect(mesh.updatedAt).toBe('2026-10-24T00:00:00.000Z')

    const trips = updated.plays.find((item) => item.id === 'trips')!
    expect(trips.players).toEqual(playbook.plays[1].players)
    expect(trips.updatedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('renames a formation without touching play timestamps', () => {
    const updated = applyFormationUpdate(playbook, 'spread', { name: 'Spread Left' })
    expect(updated.formations[0].name).toBe('Spread Left')
    expect(updated.plays).toEqual(playbook.plays)
  })
})
