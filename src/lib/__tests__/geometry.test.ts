import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import {
  MOTION_DASH,
  OPTION_ROUTE_DASH,
  clampRoutePoint,
  clampRoutePointForPlayer,
  curveFromOffset,
  fieldRoutePoints,
  flipRoutePoints,
  isRepeatClick,
  motionShape,
  optionShapes,
  routeLength,
  routeShape,
  routeOrigin,
  segmentBowPoint,
  segmentControl,
  segmentOffset,
  toSvg,
  withCurve,
} from '../geometry'

describe('isRepeatClick', () => {
  it('treats a second click on the point just placed as the end of the path', () => {
    // Both halves of a double-click land on the spot the first one placed, so
    // the pair has to leave one point behind, not two stacked on each other.
    expect(isRepeatClick({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(true)
    expect(isRepeatClick({ x: 2, y: 3.2 }, { x: 2, y: 3 })).toBe(true)
  })

  it('keeps drawing when the click lands anywhere else', () => {
    expect(isRepeatClick({ x: 2, y: 3.5 }, { x: 2, y: 3 })).toBe(false)
    expect(isRepeatClick({ x: 2, y: 3 }, undefined)).toBe(false)
    expect(isRepeatClick({ x: 2, y: 3 }, null)).toBe(false)
  })
})

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

describe('route point bounds', () => {
  it('keeps a point on the field for a player aligned anywhere', () => {
    // A receiver on the left sideline cannot draw past the left edge.
    expect(clampRoutePointForPlayer({ x: -11, y: 0 }, { x: -22, y: 4 })).toEqual({
      x: -1.4,
      y: 4,
    })
    // Nor past the right edge, the back of the field or the downfield edge.
    expect(clampRoutePointForPlayer({ x: 11, y: 2 }, { x: 30, y: 0 }).x).toBeCloseTo(1.4)
    expect(clampRoutePointForPlayer({ x: 0, y: 3 }, { x: 0, y: -30 }).y).toBeCloseTo(-10.4)
    expect(clampRoutePointForPlayer({ x: 0, y: 3 }, { x: 0, y: 30 }).y).toBeCloseTo(14.4)
  })

  it('leaves a point that is already on the field untouched', () => {
    const point = { x: 3.25, y: 9 }
    expect(clampRoutePointForPlayer({ x: -11, y: 2 }, point)).toEqual(point)
  })

  it('keeps the bow of a point it pulls back in', () => {
    expect(
      clampRoutePointForPlayer({ x: -11, y: 0 }, { x: -22, y: 4, curve: 1.5 }),
    ).toEqual({ x: -1.4, y: 4, curve: 1.5 })
  })

  it('matches the plain clamp for a player at the origin', () => {
    for (const point of [
      { x: -20, y: 2 },
      { x: 40, y: -20 },
      { x: 0, y: 30 },
      { x: 1, y: 2 },
    ]) {
      expect(clampRoutePointForPlayer({ x: 0, y: 0 }, point)).toEqual(clampRoutePoint(point))
    }
  })
})

describe('fieldRoutePoints', () => {
  it('pulls a route that points past the edge back for drawing', () => {
    expect(
      fieldRoutePoints({ x: -11, y: 0 }, [
        { x: 0, y: 3 },
        { x: -11, y: 6, curve: 0.6 },
      ]),
    ).toEqual([{ x: 0, y: 3 }, { x: -1.4, y: 6, curve: 0.6 }])
  })

  it('leaves a route that is already on the field alone', () => {
    const points = [{ x: 0, y: 3 }, { x: 4, y: 9, curve: -1 }]
    expect(fieldRoutePoints({ x: -11, y: 0 }, points)).toEqual(points)
  })

  it('draws a mirrored route inside the field', () => {
    const player: Player = {
      id: 'wr',
      role: 'Wide Receiver',
      label: 'WR-L',
      number: 11,
      color: '#FF8265',
      pos: { x: -11, y: 0 },
      route: null,
    }
    // The receiver is on the left sideline and the route runs outward.
    const shape = routeShape(player, { id: 'route', points: [{ x: 0, y: 3 }, { x: -11, y: 6 }] })
    const edge = toSvg({ x: -12.4, y: 6 })

    expect(shape?.end.x).toBeCloseTo(edge.x)
    expect(shape?.end.y).toBeCloseTo(edge.y)
  })
})

describe('motions and option routes', () => {
  const receiver: Player = {
    id: 'wr',
    role: 'Wide Receiver',
    label: 'WR-R',
    number: 11,
    color: '#64D8C4',
    pos: { x: 11, y: 0 },
    route: null,
  }

  it('draws a motion as a path from the player to its last point', () => {
    const shape = motionShape(receiver, {
      id: 'motion',
      points: [{ x: -6, y: 0 }, { x: -6, y: 2 }],
    })

    expect(shape?.d).toBe('M 23.500 17.500 L 17.500 17.500 L 17.500 15.500')
    expect(shape?.arrow.split(' ')).toHaveLength(3)
  })

  it('starts a route where the motion ends', () => {
    const shifted: Player = {
      ...receiver,
      motion: { id: 'motion', points: [{ x: -6, y: 0 }, { x: -1, y: 2 }] },
    }
    // A route is measured from the motion's last point, not the marker.
    expect(routeOrigin(shifted)).toEqual({ x: 10, y: 2 })
    expect(routeOrigin(receiver)).toEqual(receiver.pos)

    const shape = routeShape(shifted, { id: 'route', points: [{ x: 0, y: 4 }] })
    expect(shape?.d).toBe('M 22.500 15.500 L 22.500 11.500')
  })

  it('carries the whole route when the motion shifts', () => {
    const oneYard: Player = {
      ...receiver,
      motion: { id: 'motion', points: [{ x: -6, y: 0 }] },
    }
    const fourYards: Player = {
      ...receiver,
      motion: {
        id: 'motion',
        points: [{ x: -6, y: 0 }, { x: -5, y: 1 }, { x: -1, y: 3 }],
      },
    }
    const route = { id: 'route', points: [{ x: 0, y: 4 }, { x: 2, y: 8, curve: 1 }] }

    const before = routeShape(oneYard, route)
    const after = routeShape(fourYards, route)

    // The route keeps its own shape and travels with the motion: the same bow,
    // translated by the four yards the shift gained.
    expect(after?.end.x).toBeCloseTo(Number(before?.end.x) + 5)
    expect(after?.end.y).toBeCloseTo(Number(before?.end.y) - 3)
    expect(after?.angle).toBeCloseTo(Number(before?.angle))
    expect(after?.d.split(' ')[0]).toBe('M')
    expect(after?.d).not.toBe(before?.d)
  })

  it('has no shape for a motion without points', () => {
    expect(motionShape(receiver, { id: 'motion', points: [] })).toBeNull()
  })

  it('uses a different dash for motions than for option branches', () => {
    expect(MOTION_DASH).not.toBe(OPTION_ROUTE_DASH)
  })
})

describe('option branches', () => {
  const centre: Player = {
    id: 'c',
    role: 'Center',
    label: 'C',
    number: 50,
    color: '#F1EEE4',
    pos: { x: 0, y: 0 },
    route: null,
  }

  const route = {
    id: 'route',
    points: [
      { x: 0, y: 3 },
      { x: 4, y: 8 },
    ],
    options: [
      { id: 'first', from: 1, points: [{ x: 8, y: 8 }] },
      { id: 'second', from: 0, points: [{ x: -4, y: 6 }] },
    ],
  }

  it('draws each branch from the route point it leaves', () => {
    const shapes = optionShapes(centre, route)

    expect(shapes).toHaveLength(2)
    // From route point (4, 8) out to (8, 8), in SVG coordinates.
    expect(shapes[0].d).toBe('M 16.500 9.500 L 20.500 9.500')
    // A second branch leaves the first route point (0, 3) instead.
    expect(shapes[1].d).toBe('M 12.500 14.500 L 8.500 11.500')
    expect(shapes.every((shape) => shape.arrow.split(' ').length === 3)).toBe(true)
  })

  it('leaves a route without options with nothing to draw', () => {
    expect(optionShapes(centre, { id: 'plain', points: [{ x: 0, y: 3 }] })).toEqual([])
    expect(
      optionShapes(centre, { ...route, options: [{ id: 'empty', from: 0, points: [] }] }),
    ).toEqual([])
  })

  it('skips a branch whose route point no longer exists', () => {
    expect(
      optionShapes(centre, { ...route, options: [{ id: 'gone', from: 5, points: [{ x: 1, y: 1 }] }] }),
    ).toEqual([])
  })

  it('draws branches from the route as the motion leaves it', () => {
    const shifting: Player = {
      ...centre,
      motion: { id: 'motion', points: [{ x: 0, y: 1 }] },
    }

    const [branch] = optionShapes(shifting, {
      id: 'route',
      points: [{ x: 0, y: 3 }],
      options: [{ id: 'option', from: 0, points: [{ x: 2, y: 6 }] }],
    })

    // Route point (0, 3) now sits at (0, 4), so the branch leaves there and
    // ends one yard past where the same option would sit without the shift.
    expect(branch.d).toBe('M 12.500 13.500 L 14.500 10.500')
  })

  it('draws a branch inside the field even when its points run past the edge', () => {
    const receiver: Player = {
      ...centre,
      pos: { x: 11, y: 0 },
      route: null,
    }
    const shapes = optionShapes(receiver, {
      id: 'route',
      points: [{ x: 0, y: 3 }],
      options: [{ id: 'wide', from: 0, points: [{ x: 8, y: 4 }] }],
    })

    // The option's point is pulled back to the right sideline for drawing.
    expect(shapes[0].d).toBe('M 23.500 14.500 L 24.900 13.500')
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
