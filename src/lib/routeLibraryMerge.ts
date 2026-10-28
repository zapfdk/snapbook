import { cloneRouteLibrary, uniqueRouteName } from '../data/routeLibrary'
import type { LibraryRoute, RoutePoint } from '../types'

/** Route points are stored to a hundredth of a yard. */
const TOLERANCE = 0.011

/**
 * Compares two routes by the shape they are drawn with. A play mirrors a
 * library route for the receiver's side and flipping it mirrors the bow as
 * well, so the comparison ignores the horizontal direction and the sign of each
 * bow: the same route run from the other side still counts as the same route.
 */
export const sameRoutePoints = (points: RoutePoint[], other: RoutePoint[]): boolean =>
  points.length > 0 &&
  points.length === other.length &&
  points.every((point, index) => {
    const target = other[index]
    const horizontal =
      Math.abs(point.x - target.x) <= TOLERANCE || Math.abs(point.x + target.x) <= TOLERANCE
    const depth = Math.abs(point.y - target.y) <= TOLERANCE
    const bow = Math.abs(Math.abs(point.curve ?? 0) - Math.abs(target.curve ?? 0)) <= TOLERANCE
    return horizontal && depth && bow
  })

/**
 * Snapbook's preset routes, added to a library that came out of a file or an
 * import. A route the library already draws is not added twice, so importing a
 * file that carries the presets itself leaves the library as it is. A preset
 * whose name is taken by a different shape takes a suffix, since route names
 * stay unique inside a library.
 */
export function withPresetRoutes(routes: LibraryRoute[]): LibraryRoute[] {
  const merged = routes.map((route) => ({
    ...route,
    points: route.points.map((point) => ({ ...point })),
  }))
  const names = merged.map((route) => route.name)
  for (const preset of cloneRouteLibrary()) {
    // Only the routes that came in decide what is missing: the presets are a set
    // of their own, and two of them may share a shape without being clones.
    const covered = routes.some((route) => sameRoutePoints(route.points, preset.points))
    if (covered) continue
    merged.push({ ...preset, name: uniqueRouteName(preset.name, names) })
    names.push(merged[merged.length - 1].name)
  }
  return merged
}
