import { describe, expect, it } from 'vitest'
import { buildPbcArchive } from '../exportPbc'
import type { Playbook } from '../../../types'

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

const reference = normalize(`22 serialization::archive 19 0 1 6 0.22.0 4 Demo 5 0 0 1 0 0 0 12 Spread Right 0 1 4 1 0
0 1 0
1 12 Spread Right 0 0 0 1 0 0 2 1 0 1 9 1 3
2 6 Center 0 0 4 67 0 0 0 0 0 0 0 0 0.00000000000000000e+00 0.00000000000000000e+00 0 1 -1 0 1 -1 0  0 0 0 0 1 -1 -1 9
3 11 Quarterback 4 81 66 0 0 0 0 0 0.00000000000000000e+00 -5.00000000000000000e+00 -1 -1 0  0 0 1 -1 -1 0 0 0 0 0 0 0 0 0 0 0 0`)

const fullReference = normalize(`22 serialization::archive 19 0 1 6 0.22.0 4 Demo 5 0 0 1 0 0 0 12 Spread Right 0 1 4 1 0
0 1 0
1 12 Spread Right 0 0 0 1 0 0 2 1 0 1 9 1 3
2 6 Center 0 0 4 67 0 0 0 0 0 0 0 0 0.00000000000000000e+00 0.00000000000000000e+00 0 1 -1 0 1 -1 0  0 0 0 0 1 -1 -1 9
3 11 Quarterback 4 81 66 0 0 0 0 0 0.00000000000000000e+00 -5.00000000000000000e+00 -1 -1 0  0 0 1 -1 -1 0 0 0 0 0 0 1 0 0 0 9 Demo Play 0 1 21 1 1
4 9 Demo Play 2 DM 4
5
6 12 Spread Right 0 1 2 1 9
7 6 Center 4 67 0 0 0 0 0 0 0.00000000000000000e+00 0.00000000000000000e+00 -1 -1 0  0 0 1 -1 -1 9
8 11 Quarterback 4 81 66 0 0 0 0 0 0.00000000000000000e+00 -5.00000000000000000e+00 13 1 0
9 0 0 0 0 2 1 0 1 25 1 2
10 1.00000000000000000e+00 8.00000000000000000e+00 2.22507385850720138e-308 2.22507385850720138e-308 25
11 -2.00000000000000000e+00 1.20000000000000000e+01 2.22507385850720138e-308 2.22507385850720138e-308 0  0  -1 0  0 0 1 -1 -1 0 0 1 1 0 1 5
12 4 Test 1 1 21 4 4 Note 0 0 1 0 0 0 4 Test 5 12`)

describe('PBC Boost archive', () => {
  it('matches the token stream produced by native Boost.Serialization', () => {
    const playbook: Playbook = {
      id: 'pb',
      name: 'Demo',
      team: '',
      level: '5v5',
      formations: [
        {
          id: 'formation',
          name: 'Spread Right',
          players: [
            {
              id: 'p1',
              role: 'Center',
              label: 'C',
              number: null,
              color: '#000000',
              pos: { x: 0, y: 0 },
              route: null,
            },
            {
              id: 'p2',
              role: 'Quarterback',
              label: 'QB',
              number: null,
              color: '#000000',
              pos: { x: 0, y: -5 },
              route: null,
            },
          ],
        },
      ],
      plays: [],
      categories: [],
      routes: [],
    }
    expect(normalize(buildPbcArchive(playbook))).toBe(reference)
  })

  it('matches native Boost for routes, plays and category cross references', () => {
    const center = {
      id: 'c',
      role: 'Center',
      label: 'C',
      number: null,
      color: '#000000',
      pos: { x: 0, y: 0 },
      route: null,
    }
    const qb = {
      id: 'q',
      role: 'Quarterback',
      label: 'QB',
      number: null,
      color: '#000000',
      pos: { x: 0, y: -5 },
      route: null,
    }
    const playbook: Playbook = {
      id: 'pb',
      name: 'Demo',
      team: '',
      level: '5v5',
      formations: [{ id: 'f', name: 'Spread Right', players: [center, qb] }],
      categories: [{ id: 'cat', name: 'Test', color: '#000000' }],
      routes: [],
      plays: [
        {
          id: 'play',
          name: 'Demo Play',
          codeName: 'DM',
          formationId: 'f',
          players: [
            center,
            {
              ...qb,
              route: {
                id: 'r',
                points: [
                  { x: -1, y: 8 },
                  { x: 2, y: 12 },
                ],
              },
            },
          ],
          categories: ['cat'],
          notes: 'Note',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }
    expect(normalize(buildPbcArchive(playbook))).toBe(fullReference)
  })
})
