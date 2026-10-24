import { describe, expect, it } from 'vitest'
import type { Play, Playbook, Player } from '../../types'
import {
  applyRosterGroupPatch,
  defaultRosterColor,
  getRosterGroups,
  roleKey,
} from '../roster'

const player = (
  id: string,
  role: string,
  label: string,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  role,
  label,
  number: null,
  color: '#F1EEE4',
  pos: { x: 0, y: 0 },
  route: null,
  ...overrides,
})

const center = player('c1', 'Center', 'C', { color: '#F1EEE4' })
const qb = player('q1', 'Quarterback', 'QB', { color: '#F4C95D', pos: { x: 0, y: -4.5 } })
const left = player('l1', 'Wide Receiver Left', 'WR-L', {
  color: '#FF8265',
  pos: { x: -11, y: 0 },
})
const slot = player('s1', 'Slot Receiver', 'SLOT', {
  color: '#82B7FF',
  pos: { x: 6, y: -1 },
})

const basePlay = {
  codeName: '',
  formationId: 'spread',
  categories: [],
  notes: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
} satisfies Partial<Play>

const playbook: Playbook = {
  id: 'book',
  name: 'Demo',
  team: 'Demo',
  level: '5v5',
  categories: [],
  routes: [],
  formations: [
    { id: 'spread', name: 'Spread', players: [center, qb, left] },
    {
      id: 'trips',
      name: 'Trips',
      players: [
        player('c2', 'Center', 'C', { number: 50 }),
        player('q2', 'Quarterback', 'QB'),
        slot,
      ],
    },
  ],
  plays: [
    {
      ...basePlay,
      id: 'play-1',
      name: 'Mesh',
      players: [
        player('pc1', 'Center', 'C'),
        player('pq1', 'Quarterback', 'QB'),
        player('pl1', 'Wide Receiver Left', 'X', {
          number: 88,
          color: '#FF0000',
          pos: { x: -10, y: 1 },
          route: { id: 'route-1', points: [{ x: 0, y: 3 }, { x: 12, y: 4 }] },
        }),
      ],
    },
    {
      ...basePlay,
      id: 'play-2',
      name: 'Flood',
      players: [
        player('pc2', 'Center', 'C'),
        player('pq2', 'Quarterback', 'QB'),
        player('ps2', 'Slot Receiver', 'SLOT'),
      ],
    },
  ],
}

describe('team roster configuration', () => {
  it('groups distinct player roles across formations and plays', () => {
    const groups = getRosterGroups(playbook)

    expect(groups.map((group) => group.role)).toEqual([
      'Center',
      'Quarterback',
      'Wide Receiver Left',
      'Slot Receiver',
    ])
    expect(groups[0]).toMatchObject({
      key: 'center',
      label: 'C',
      formationCount: 2,
      playCount: 2,
    })
    expect(groups[1]).toMatchObject({ formationCount: 2, playCount: 2 })
    expect(groups[2]).toMatchObject({ formationCount: 1, playCount: 1 })
    expect(groups[3]).toMatchObject({ formationCount: 1, playCount: 1 })
  })

  it('applies a name, label, number and color everywhere that role appears', () => {
    const patched = applyRosterGroupPatch(playbook, 'wide receiver left', {
      role: 'Z Receiver',
      label: 'z',
      number: 88,
      color: '#123456',
    })

    const formationPlayer = patched.formations[0].players[2]
    expect(formationPlayer).toMatchObject({
      role: 'Z Receiver',
      label: 'Z',
      number: 88,
      color: '#123456',
      pos: { x: -11, y: 0 },
    })

    const playPlayer = patched.plays[0].players[2]
    expect(playPlayer).toMatchObject({
      role: 'Z Receiver',
      label: 'Z',
      number: 88,
      color: '#123456',
      pos: { x: -10, y: 1 },
    })
    expect(playPlayer.route?.points).toEqual([
      { x: 0, y: 3 },
      { x: 12, y: 4 },
    ])

    expect(patched.formations[0].players[1].color).toBe('#F4C95D')
    expect(patched.plays[0].updatedAt).toBe(playbook.plays[0].updatedAt)
    expect(roleKey('  WIDE receiver LEFT  ')).toBe('wide receiver left')
    const regrouped = getRosterGroups(patched)
    expect(regrouped[2].role).toBe('Z Receiver')
    expect(regrouped.find((group) => group.role === 'Z Receiver')?.playCount).toBe(1)
  })

  it('normalizes labels and numbers and leaves no-op edits untouched', () => {
    const patched = applyRosterGroupPatch(playbook, 'Quarterback', {
      label: 'quarterback!',
      number: 140,
    })

    expect(patched.formations[0].players[1]).toMatchObject({
      label: 'QUAR',
      number: 99,
    })
    expect(applyRosterGroupPatch(playbook, 'Center', {})).toBe(playbook)
  })

  it('offers the starter color for a role and a fallback for custom roles', () => {
    expect(defaultRosterColor('Center')).toBe('#F1EEE4')
    expect(defaultRosterColor('Custom role', 1)).toBe('#F4C95D')
  })
})
