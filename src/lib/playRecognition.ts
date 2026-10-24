import { ROUTE_PRESETS } from '../data/defaults'
import type { RoutePreset } from '../data/routePresets'
import { clampRoutePoint, segmentControl } from './geometry'
import type { Player, Point, RoutePoint } from '../types'

const SAMPLE_COUNT = 28
const MAX_AVERAGE_ERROR = 2.1
const MAX_END_ERROR = 4.2
const MIN_ROUTE_LENGTH = 2.2

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Route presets are authored for a player on the left side of the field. */
export const playerRouteSign = (player: Player) => (player.pos.x > 0 ? -1 : 1)

export function findPlayerNear(
  players: Player[],
  point: Point,
  maxDistance = 3.4,
): Player | null {
  let nearest: Player | null = null
  let nearestDistance = maxDistance

  for (const player of players) {
    const gap = distance(player.pos, point)
    if (gap <= nearestDistance) {
      nearest = player
      nearestDistance = gap
    }
  }

  return nearest
}

export const polylineLength = (points: Point[]) =>
  points.reduce(
    (total, point, index) =>
      total + (index ? distance(points[index - 1], point) : 0),
    0,
  )

/**
 * Re-samples a polyline at evenly spaced points along its length. Comparing two
 * paths at the same relative positions keeps small drawing differences from
 * dominating the score.
 */
function resample(points: Point[], count: number): Point[] {
  if (!points.length) return []
  if (points.length === 1 || count < 2) {
    return Array.from({ length: count }, () => ({ ...points[0] }))
  }

  const cumulative = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]))
  }

  const total = cumulative[cumulative.length - 1]
  if (total === 0) {
    return Array.from({ length: count }, () => ({ ...points[0] }))
  }

  const result: Point[] = []
  let segment = 1

  for (let index = 0; index < count; index += 1) {
    const target = (total * index) / (count - 1)
    while (segment < cumulative.length - 1 && cumulative[segment] < target) {
      segment += 1
    }
    const startDistance = cumulative[segment - 1]
    const segmentLength = cumulative[segment] - startDistance
    const progress = segmentLength ? (target - startDistance) / segmentLength : 0

    result.push({
      x: points[segment - 1].x + (points[segment].x - points[segment - 1].x) * progress,
      y: points[segment - 1].y + (points[segment].y - points[segment - 1].y) * progress,
    })
  }

  return result
}

/** Samples a preset route, including its curved segments, from the player out. */
export function sampleRoutePath(points: RoutePoint[], count = SAMPLE_COUNT): Point[] {
  const path: Point[] = [{ x: 0, y: 0 }]
  let previous = path[0]

  for (const point of points) {
    const end = { x: point.x, y: point.y }
    const control = segmentControl(previous, end, point.curve)

    if (control) {
      const steps = 8
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps
        const inverse = 1 - t
        path.push({
          x: inverse * inverse * previous.x + 2 * inverse * t * control.x + t * t * end.x,
          y: inverse * inverse * previous.y + 2 * inverse * t * control.y + t * t * end.y,
        })
      }
    } else {
      path.push(end)
    }

    previous = end
  }

  return resample(path, count)
}

export interface RouteMatch {
  preset: RoutePreset
  averageError: number
  endError: number
  lengthRatio: number
}

/**
 * Finds the closest clean preset for a hand-drawn relative route. Presets are
 * mirrored to match the receiver's side, and a route is only accepted when it
 * is close enough in shape, finish and length to trust the replacement.
 */
export function matchRoutePreset(
  points: Point[],
  sign: number,
  presets: RoutePreset[] = ROUTE_PRESETS,
): RouteMatch | null {
  if (points.length < 2) return null

  const stroke = resample([{ x: 0, y: 0 }, ...points], SAMPLE_COUNT)
  const strokeLength = polylineLength([{ x: 0, y: 0 }, ...points])
  if (strokeLength < MIN_ROUTE_LENGTH) return null

  let best: RouteMatch | null = null
  let bestScore = Infinity

  for (const preset of presets) {
    const mirrored = preset.points.map((point) => ({
      ...point,
      x: point.x * sign,
    }))
    const target = sampleRoutePath(mirrored)
    const presetLength = polylineLength(sampleRoutePath(mirrored, 64))
    if (!presetLength) continue

    let totalError = 0
    for (let index = 0; index < stroke.length; index += 1) {
      totalError += distance(stroke[index], target[index])
    }

    const averageError = totalError / stroke.length
    const endError = distance(stroke[stroke.length - 1], target[target.length - 1])
    const lengthRatio = strokeLength / presetLength

    // Reject implausible candidates before ranking so a nearly-shaped but
    // wrongly-sized route cannot hide a good match behind it.
    if (averageError > MAX_AVERAGE_ERROR) continue
    if (endError > MAX_END_ERROR) continue
    if (lengthRatio < 0.6 || lengthRatio > 1.6) continue

    const score = averageError + endError * 0.25
    if (score < bestScore) {
      best = { preset, averageError, endError, lengthRatio }
      bestScore = score
    }
  }

  return best
}

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (!dx && !dy) return distance(point, start)
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  const clamped = Math.max(0, Math.min(1, t))
  return distance(point, {
    x: start.x + clamped * dx,
    y: start.y + clamped * dy,
  })
}

function simplifyRdp(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  let maxDistance = 0
  let splitIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const gap = perpendicularDistance(points[index], points[0], points[points.length - 1])
    if (gap > maxDistance) {
      maxDistance = gap
      splitIndex = index
    }
  }

  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]]

  const before = simplifyRdp(points.slice(0, splitIndex + 1), tolerance)
  const after = simplifyRdp(points.slice(splitIndex), tolerance)
  return [...before, ...after.slice(1)]
}

const roundPoint = (point: Point) => ({
  x: Math.round(point.x * 10) / 10,
  y: Math.round(point.y * 10) / 10,
})

/**
 * Turns a drawn stroke into a route that can be stored. The player itself is
 * the route origin, so early points that only cover the marker are removed.
 */
export function simplifyFreehandRoute(points: Point[]): RoutePoint[] {
  const cleaned = points
    .map((point) => clampRoutePoint(point))
    .filter((point, index, all) => index === 0 || distance(point, all[index - 1]) > 0.08)
    .filter((point) => Math.hypot(point.x, point.y) > 0.6)

  if (!cleaned.length) return []

  let tolerance = 0.3
  let simplified = simplifyRdp(cleaned, tolerance)
  while (simplified.length > 10 && tolerance < 3) {
    tolerance *= 1.6
    simplified = simplifyRdp(cleaned, tolerance)
  }

  if (simplified.length > 10) {
    simplified = Array.from({ length: 10 }, (_, index) => {
      const source = Math.round((index / 9) * (cleaned.length - 1))
      return cleaned[source]
    })
  }

  return simplified.map(roundPoint)
}
