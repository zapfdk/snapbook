import type { Motion, Player, Point, Route, RouteOption, RoutePoint } from '../types'

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

/** Absolute field position of an offset from a reference point. */
export const offsetPoint = (origin: Point, point: Point): Point => ({
  x: origin.x + point.x,
  y: origin.y + point.y,
})

/**
 * Where a player starts running: the end of the motion, if there is one.
 *
 * Everything the player runs after that — the route and every option that
 * breaks off it — is measured from here, so the route travels with the motion:
 * move the last motion point and the whole route shifts with it instead of
 * stretching its first segment out of shape.
 */
export function routeOrigin(player: Player): Point {
  const motion = player.motion?.points
  if (!motion?.length) return player.pos
  return offsetPoint(player.pos, motion[motion.length - 1])
}

/** Field edges, inset so a route point's handle stays fully drawn. */
export const ROUTE_FIELD_BOUNDS = {
  minX: -12.4,
  maxX: 12.4,
  minY: -7.4,
  maxY: 17.4,
} as const

/** Clamps a route point for a player aligned at the field origin. */
export const clampRoutePoint = (point: Point): Point => ({
  x: clamp(point.x, ROUTE_FIELD_BOUNDS.minX, ROUTE_FIELD_BOUNDS.maxX),
  y: clamp(point.y, ROUTE_FIELD_BOUNDS.minY, ROUTE_FIELD_BOUNDS.maxY),
})

/**
 * Keeps a drawn point on the field. Route and motion points are offsets from an
 * origin — a player's alignment, or the end of a motion — so the field edges
 * only mean something once that origin is added back: a receiver aligned near a
 * sideline could otherwise drag a route point off the field, where it is
 * clipped and cannot be grabbed again.
 */
export const clampRoutePointForPlayer = <T extends Point>(
  origin: Point,
  point: T,
): T => ({
  ...point,
  x: Number(
    (
      clamp(origin.x + point.x, ROUTE_FIELD_BOUNDS.minX, ROUTE_FIELD_BOUNDS.maxX) - origin.x
    ).toFixed(2),
  ),
  y: Number(
    (
      clamp(origin.y + point.y, ROUTE_FIELD_BOUNDS.minY, ROUTE_FIELD_BOUNDS.maxY) - origin.y
    ).toFixed(2),
  ),
})

export const snap = (value: number, step: number) => Math.round(value / step) * step

export interface ControlPoint {
  x: number
  y: number
}

/** Absolute field coordinates of a point offset from the player's alignment. */
export const absolutePoint = (player: Player, point: Point): Point => offsetPoint(player.pos, point)

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

/**
 * How close two clicks have to land to count as the same spot. Both halves of a
 * double-click land well inside this, so the second one finishes the path
 * instead of stacking a duplicate point on the first.
 */
export const REPEAT_CLICK_RADIUS = 0.4

/** True when a click lands on the point that was just placed: the path ends. */
export const isRepeatClick = (point: Point, last?: Point | null): boolean =>
  Boolean(last && Math.hypot(point.x - last.x, point.y - last.y) < REPEAT_CLICK_RADIUS)

/** SVG dash pattern for a pre-snap motion. */
export const MOTION_DASH = '0.5 0.28'
/** SVG dash pattern for an option branch: closely spaced round dots. */
export const OPTION_ROUTE_DASH = '0.04 0.26'

/**
 * The points a route is drawn with, as offsets from the origin they are
 * measured from. A route can legitimately point past the field edge: flipping
 * one mirrors it over the far edge, and a library route can be applied to any
 * alignment or motion. Drawing pulls those points back so the route, its arrow
 * and its handles always stay on the field, while the stored points keep their
 * real shape, so flipping a route back restores exactly what it was.
 */
export const fieldRoutePoints = (origin: Point, points: RoutePoint[]): RoutePoint[] =>
  points.map((point) => clampRoutePointForPlayer(origin, point))

/** Builds the drawn path from an absolute start point through relative points. */
export function pathShape(
  startField: Point,
  points: RoutePoint[],
  origin: Point,
): RouteShape | null {
  if (!points.length) return null
  const start = toSvg(startField)
  let previousField = startField
  const parts = [`M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`]
  let tangent = { x: 0, y: -1 }
  let end = start

  for (const point of points) {
    const absolute = offsetPoint(origin, point)
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
 * The route's path, starting where the player's motion ends. The route's own
 * points stay offsets from that start, so reshaping a motion carries the whole
 * route along without rewriting it.
 */
export function routeShape(player: Player, route: Route): RouteShape | null {
  const origin = routeOrigin(player)
  return pathShape(origin, fieldRoutePoints(origin, route.points), origin)
}

/** The path a pre-snap motion is drawn with, or null when the player is still. */
export const motionShape = (player: Player, motion: Motion): RouteShape | null =>
  motion.points.length
    ? pathShape(player.pos, fieldRoutePoints(player.pos, motion.points), player.pos)
    : null

/** Absolute point a route option leaves the route from, or null if it is gone. */
export function optionBranchPoint(player: Player, route: Route, option: RouteOption): Point | null {
  const origin = routeOrigin(player)
  const branch = fieldRoutePoints(origin, route.points)[option.from]
  return branch ? offsetPoint(origin, branch) : null
}

/** One dotted branch, drawn from its route point through its own points. */
export function optionShape(
  player: Player,
  route: Route,
  option: RouteOption,
): RouteShape | null {
  if (!option.points.length) return null
  const origin = routeOrigin(player)
  const branch = fieldRoutePoints(origin, route.points)[option.from]
  if (!branch) return null
  return pathShape(
    offsetPoint(origin, branch),
    fieldRoutePoints(origin, option.points),
    origin,
  )
}

/** Every drawable branch of a route, in the order the coach added them. */
export function optionShapes(player: Player, route: Route): RouteShape[] {
  return (route.options ?? []).flatMap((option) => {
    const shape = optionShape(player, route, option)
    return shape ? [shape] : []
  })
}

/** The dotted preview of an option being drawn from route point `from`. */
export function optionDraftShape(
  player: Player,
  route: Route,
  from: number,
  points: RoutePoint[],
): RouteShape | null {
  if (!points.length) return null
  const origin = routeOrigin(player)
  const branch = fieldRoutePoints(origin, route.points)[from]
  if (!branch) return null
  return pathShape(offsetPoint(origin, branch), points, origin)
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
