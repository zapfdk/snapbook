import { describe, expect, it } from 'vitest'
import { flipRoutePoints, routeLength } from '../geometry'

describe('routeLength', () => {
  it('sums the distance between route points', () => {
    expect(
      routeLength({
        id: 'route',
        points: [
          { x: 0, y: 5 },
          { x: 5, y: 5 },
        ],
      }),
    ).toBeCloseTo(10)
  })

  it('starts from the player and ignores unused break points', () => {
    expect(
      routeLength({
        id: 'route',
        points: [{ x: 0, y: 12 }],
      }),
    ).toBeCloseTo(12)
  })
})

describe('flipRoutePoints', () => {
  it('mirrors horizontal movement and curve direction', () => {
    expect(
      flipRoutePoints([
        { x: 3.5, y: 2 },
        { x: 6, y: 7, curve: 1.25 },
        { x: -1, y: 10, curve: -0.5 },
      ]),
    ).toEqual([
      { x: -3.5, y: 2 },
      { x: -6, y: 7, curve: -1.25 },
      { x: 1, y: 10, curve: 0.5 },
    ])
  })

  it('returns the original route after flipping twice', () => {
    const points = [
      { x: 0, y: 4 },
      { x: 4.5, y: 9, curve: 1.5 },
      { x: 2, y: 14, curve: -2 },
    ]
    const flipped = flipRoutePoints(flipRoutePoints(points))

    expect(flipped).toEqual(points)
    expect(Object.is(flipped[0].x, -0)).toBe(false)
  })
})
