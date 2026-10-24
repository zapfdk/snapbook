import { describe, expect, it } from 'vitest'
import { routeLength } from '../geometry'

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
