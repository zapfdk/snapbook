import { describe, expect, it } from 'vitest'
import {
  curveFromOffset,
  flipRoutePoints,
  routeLength,
  segmentBowPoint,
  segmentControl,
  segmentOffset,
  withCurve,
} from '../geometry'

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

describe('segment bows', () => {
  const from = { x: 0, y: 0 }
  const to = { x: 0, y: 10 }

  it('puts the bow handle on the midpoint and on the drawn curve', () => {
    expect(segmentBowPoint(from, to, undefined)).toEqual({ x: 0, y: 5 })
    expect(segmentBowPoint(from, to, 0)).toEqual({ x: 0, y: 5 })

    const bow = segmentBowPoint(from, to, 2)
    const control = segmentControl(from, to, 2)!
    // Same point the renderer's quadratic Bézier reaches half way along.
    expect(bow.x).toBeCloseTo(0.25 * from.x + 0.5 * control.x + 0.25 * to.x)
    expect(bow.y).toBeCloseTo(0.25 * from.y + 0.5 * control.y + 0.25 * to.y)
    expect(bow.x).toBeCloseTo(-1)
    expect(bow.y).toBeCloseTo(5)
  })

  it('measures how far a pointer sits to one side of the segment', () => {
    expect(segmentOffset(from, to, { x: -1.2, y: 5 })).toBeCloseTo(1.2)
    expect(segmentOffset(from, to, { x: 2, y: 99 })).toBeCloseTo(-2)
    expect(segmentOffset(from, to, { x: 0, y: 10 })).toBeCloseTo(0)
    expect(segmentOffset({ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 9, y: 9 })).toBe(0)
  })

  it('turns a dragged offset into a bow that follows the pointer', () => {
    expect(curveFromOffset(0)).toBe(0)
    // Close to the line means straight again.
    expect(curveFromOffset(0.05)).toBe(0)
    expect(curveFromOffset(-0.05)).toBe(0)
    // The drawn bow is half the stored curve, so the offset doubles.
    expect(curveFromOffset(0.5)).toBe(1)
    expect(curveFromOffset(0.26)).toBe(0.5)
    expect(curveFromOffset(-0.55)).toBe(-1.1)
    expect(curveFromOffset(9)).toBe(5)
    expect(curveFromOffset(-9)).toBe(-5)
  })

  it('straightens a point by dropping its bow', () => {
    const bent = { x: 2, y: 4, curve: 1.5 }
    expect(withCurve(bent, 0)).toEqual({ x: 2, y: 4 })
    expect(Object.keys(withCurve(bent, 0))).toEqual(['x', 'y'])
    expect(withCurve({ x: 2, y: 4 }, -0.7)).toEqual({ x: 2, y: 4, curve: -0.7 })
    expect(bent.curve).toBe(1.5)
  })

  it('round-trips a bow through the handle position', () => {
    for (const curve of [0.4, -0.9, 2, -3.7]) {
      const bow = segmentBowPoint(from, { x: 6, y: 8 }, curve)
      expect(curveFromOffset(segmentOffset(from, { x: 6, y: 8 }, bow))).toBeCloseTo(
        curve,
        5,
      )
    }
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
