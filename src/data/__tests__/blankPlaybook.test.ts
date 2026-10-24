import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYBOOK, createBlankPlaybook } from '../defaults'

describe('createBlankPlaybook', () => {
  it('creates a usable empty playbook with starter formations and tags', () => {
    const blank = createBlankPlaybook('  Friday night  ', '  Hawks  ')

    expect(blank.name).toBe('Friday night')
    expect(blank.team).toBe('Hawks')
    expect(blank.plays).toEqual([])
    expect(blank.formations).toHaveLength(DEFAULT_PLAYBOOK.formations.length)
    expect(blank.categories).toHaveLength(DEFAULT_PLAYBOOK.categories.length)
    expect(blank.routes).toHaveLength(DEFAULT_PLAYBOOK.routes.length)
    expect(blank.routes[0].name).toBe(DEFAULT_PLAYBOOK.routes[0].name)
    expect(blank.formations[0].name).toBe('Spread Right')
    expect(blank.formations.every((formation) => formation.players.length === 5)).toBe(true)
    expect(
      blank.formations
        .flatMap((formation) => formation.players)
        .every((player) => player.route === null),
    ).toBe(true)
  })

  it('uses fresh ids and leaves the starter playbook untouched', () => {
    const blank = createBlankPlaybook('A playbook', '')
    const starterIds = new Set([
      DEFAULT_PLAYBOOK.id,
      ...DEFAULT_PLAYBOOK.formations.flatMap((formation) => [
        formation.id,
        ...formation.players.map((player) => player.id),
      ]),
    ])

    expect(starterIds.has(blank.id)).toBe(false)
    for (const formation of blank.formations) {
      expect(starterIds.has(formation.id)).toBe(false)
      for (const player of formation.players) {
        expect(starterIds.has(player.id)).toBe(false)
      }
    }

    blank.formations[0].players[0].pos.x = 99
    expect(DEFAULT_PLAYBOOK.formations[0].players[0].pos.x).toBe(0)

    blank.routes[0].points[0].x = 99
    expect(DEFAULT_PLAYBOOK.routes[0].points[0].x).not.toBe(99)
  })

  it('falls back to a readable name', () => {
    expect(createBlankPlaybook('   ', '').name).toBe('My flag playbook')
  })
})
