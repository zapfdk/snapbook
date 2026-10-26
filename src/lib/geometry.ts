import type { Player, Point, Route, RoutePoint } from '../types'

export const FIELD_WIDTH = 25
export const FIELD_HEIGHT = 25
export const LOS_FROM_TOP = 17.5
export const YARD_LINES = [2.5, 7.5, 12.5, 17.5, 22.5] as const

export const toSvg = (point: Point): Point => ({
  x: point.x + FIELD_WIDTH / 2,
  y: LOS_FROM_TOP - point.y,
})

export const toField = (point: Point): Point => ({
  x: point.x - FIELD_WIDTH / 2,
  y: LOS_FROM_TOP - point.y,
})

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const clampPlayerPoint = (point: Point): Point => ({
  x: clamp(point.x, -12.1, 12.1),
  y: clamp(point.y, -7.1, 16.4),
})

export const clampRoutePoint = (point: Point): Point => ({
  x: clamp(point.x, -12.4, 12.4),
  y: clamp(point.y, -7.4, 17.4),
})

export const snap = (value: number, step: number) => Math.round(value / step) * step

export interface ControlPoint {
  x: number
  y: number
}

/** Absolute field coordinates of a route point for a given player. */
export const absolutePoint = (player: Player, point: Point): Point => ({
  x: player.pos.x + point.x,
  y: player.pos.y + point.y,
})

/** Quadratic control point for a segment, in absolute field coordinates. */
export function segmentControl(
  from: Point,
  to: Point,
  curve: number | undefined,
): ControlPoint | null {
  if (!curve) return null
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const normal = { x: -dy / length, y: dx / length }
  return {
    x: (from.x + to.x) / 2 + normal.x * curve,
    y: (from.y + to.y) / 2 + normal.y * curve,
  }
}

/**
 * Point on the drawn segment half way along it: the top of its bow, which for a
 * straight segment is the plain midpoint. This is where the curve handle sits,
 * so a bow can be dragged to where the pointer is.
 */
export function segmentBowPoint(
  from: Point,
  to: Point,
  curve: number | undefined,
): Point {
  const control = segmentControl(from, to, curve)
  if (!control) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  return {
    x: (from.x + 2 * control.x + to.x) / 4,
    y: (from.y + 2 * control.y + to.y) / 4,
  }
}

/** A route point with its bow set, or no `curve` at all when it is straight. */
export const withCurve = (point: RoutePoint, curve: number): RoutePoint => {
  if (curve) return { ...point, curve }
  const { curve: _straightened, ...rest } = point
  return rest
}

/** Signed distance of a pointer from the segment's line, in yards. */
export function segmentOffset(from: Point, to: Point, pointer: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (!length) return 0
  return (
    (pointer.x - (from.x + to.x) / 2) * (-dy / length) +
    (pointer.y - (from.y + to.y) / 2) * (dx / length)
  )
}

/**
 * Curve value that puts the top of the bow under the pointer. The drawn bow is
 * half the stored curve, so the offset doubles; dragging onto the line, or very
 * close to it, straightens the segment again.
 */
export function curveFromOffset(offset: number, step = 0.1, limit = 5): number {
  if (!Number.isFinite(offset) || Math.abs(offset) < step) return 0
  const value = Number(snap(offset * 2, step).toFixed(2))
  return clamp(value, -limit, limit)
}

export interface RouteShape {
  /** SVG path in field units. */
  d: string
  end: Point
  angle: number
  arrow: string
}

export function routeShape(player: Player, route: Route): RouteShape | null {
  if (!route.points.length) return null
  const startField = player.pos
  const start = toSvg(startField)
  let previousField = startField
  const parts = [`M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`]
  let tangent = { x: 0, y: -1 }
  let end = start

  for (const point of route.points) {
    const absolute = absolutePoint(player, point)
    end = toSvg(absolute)
    const controlField = segmentControl(previousField, absolute, point.curve)
    if (controlField) {
      const control = toSvg(controlField)
      parts.push(
        `Q ${control.x.toFixed(3)} ${control.y.toFixed(3)} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
      )
      tangent = { x: end.x - control.x, y: end.y - control.y }
    } else {
      parts.push(`L ${end.x.toFixed(3)} ${end.y.toFixed(3)}`)
      const previous = toSvg(previousField)
      tangent = { x: end.x - previous.x, y: end.y - previous.y }
    }
    previousField = absolute
  }

  const magnitude = Math.hypot(tangent.x, tangent.y) || 1
  const ux = tangent.x / magnitude
  const uy = tangent.y / magnitude
  const size = 0.95
  const spread = 0.52
  const base = { x: end.x - ux * size, y: end.y - uy * size }
  const left = { x: base.x - uy * size * spread, y: base.y + ux * size * spread }
  const right = { x: base.x + uy * size * spread, y: base.y - ux * size * spread }
  const arrow = `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`

  return {
    d: parts.join(' '),
    end,
    angle: Math.atan2(tangent.y, tangent.x),
    arrow,
  }
}

/**
 * Mirrors a route across the player's alignment. Curve bows are flipped too so
 * the bend keeps its shape on the opposite side.
 */
export const flipRoutePoints = (points: RoutePoint[]): RoutePoint[] =>
  points.map((point) => ({
    x: point.x === 0 ? 0 : -point.x,
    y: point.y,
    ...(point.curve ? { curve: -point.curve } : {}),
  }))

export const routeLength = (route: Route) =>
  route.points.reduce((total, point, index) => {
    const previous = index === 0 ? { x: 0, y: 0 } : route.points[index - 1]
    return total + Math.hypot(point.x - previous.x, point.y - previous.y)
  }, 0)

export const addPoint = (points: RoutePoint[], point: RoutePoint): RoutePoint[] => [
  ...points,
  point,
]

export const formatYards = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}
