import { describe, expect, it } from 'vitest'
import { ROUTE_PRESETS } from '../../data/defaults'
import type { Player } from '../../types'
import {
  findPlayerNear,
  matchRoutePreset,
  playerRouteSign,
  simplifyFreehandRoute,
} from '../playRecognition'

const receiver = (label: string, x: number): Player => ({
  id: label,
  label,
  role: label,
  number: null,
  color: '#ffffff',
  pos: { x, y: 0 },
  route: null,
})

const preset = (id: string) => {
  const route = ROUTE_PRESETS.find((item) => item.id === id)
  if (!route) throw new Error(`Missing preset ${id}`)
  return route
}

describe('sketch play recognition', () => {
  it('finds the closest player to the start of a stroke', () => {
    const left = receiver('WR-L', -11)
    const right = receiver('WR-R', 11)

    expect(findPlayerNear([left, right], { x: -10.4, y: 0.6 })).toBe(left)
    expect(findPlayerNear([left, right], { x: 9.8, y: -0.4 })).toBe(right)
    expect(findPlayerNear([left, right], { x: 0, y: 14 })).toBeNull()
  })

  it('uses the same side convention as applying a preset to a player', () => {
    expect(playerRouteSign(receiver('WR-L', -11))).toBe(1)
    expect(playerRouteSign(receiver('WR-R', 11))).toBe(-1)
    expect(playerRouteSign(receiver('C', 0))).toBe(1)
  })

  it.each(['post', 'corner', 'out', 'slant', 'wheel', 'dig'])(
    'recognises a clean %s stroke',
    (id) => {
      const match = matchRoutePreset(preset(id).points, 1)
      expect(match?.preset.id).toBe(id)
    },
  )

  it('mirrors presets for a receiver on the right side', () => {
    const mirrored = preset('out').points.map((point) => ({ ...point, x: point.x * -1 }))
    expect(matchRoutePreset(mirrored, -1)?.preset.id).toBe('out')
  })

  it('tolerates a sloppy drawing of a slant', () => {
    const match = matchRoutePreset(
      [
        { x: 0.2, y: 2.3 },
        { x: 5.1, y: 5.7 },
      ],
      1,
    )
    expect(match?.preset.id).toBe('slant')
  })

  it('leaves an unrelated zig-zag as freehand', () => {
    const match = matchRoutePreset(
      [
        { x: 0, y: 4 },
        { x: 7, y: 4 },
        { x: 7, y: 8 },
        { x: -4, y: 8 },
      ],
      1,
    )
    expect(match).toBeNull()
  })

  it('simplifies a straight freehand stroke to its endpoints', () => {
    const route = simplifyFreehandRoute([
      { x: 0.1, y: 0.2 },
      { x: 0.2, y: 2 },
      { x: 0.3, y: 4 },
      { x: 0.35, y: 6 },
      { x: 0.4, y: 8 },
    ])

    expect(route).toEqual([
      { x: 0.2, y: 2 },
      { x: 0.4, y: 8 },
    ])
  })

  it('keeps a freehand break while discarding jitter', () => {
    const route = simplifyFreehandRoute([
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 0.1, y: 5 },
      { x: 4, y: 8 },
      { x: 8, y: 8 },
    ])

    expect(route.length).toBeGreaterThan(2)
    expect(route[route.length - 1]).toEqual({ x: 8, y: 8 })
  })
})
