import { ROUTE_PRESETS, type RoutePreset } from './routePresets'
import { createId, type LibraryRoute, type RouteGroup } from '../types'

export type { RouteGroup }

export const ROUTE_GROUPS: RouteGroup[] = ['Quick game', 'Intermediate', 'Deep']

export const ROUTE_GROUP_COLORS: Record<RouteGroup, string> = {
  'Quick game': '#F4C95D',
  Intermediate: '#82B7FF',
  Deep: '#FF7A59',
}

interface RouteMeta {
  group: RouteGroup
  note: string
}

const META: Record<string, RouteMeta> = {
  go: { group: 'Deep', note: 'A pure vertical stem. Stretch the deepest defender and track the ball over your shoulder.' },
  post: { group: 'Deep', note: 'Stem vertical, then break to the middle of the field at 12–14 yards.' },
  corner: { group: 'Deep', note: 'Stem vertical, then break toward the sideline to get on top of the corner.' },
  out: { group: 'Quick game', note: 'A short vertical stem, then break flat to the boundary.' },
  dig: { group: 'Intermediate', note: 'Vertical stem, then break across the middle at 9–12 yards.' },
  slant: { group: 'Quick game', note: 'One quick step inside, then angle across the middle behind the linebackers.' },
  curl: { group: 'Intermediate', note: 'Push vertical, then turn back to the quarterback at 8–10 yards.' },
  comeback: { group: 'Intermediate', note: 'Sell the vertical route, then come back to the ball at 9–10 yards.' },
  hitch: { group: 'Quick game', note: 'A quick five-yard stem, turn and sit in the window.' },
  flat: { group: 'Quick game', note: 'Release outside immediately and work to the sideline at the LOS.' },
  swing: { group: 'Quick game', note: 'Cheat behind the line and catch the ball on the move.' },
  wheel: { group: 'Deep', note: 'Flat release, then accelerate up the sideline behind the defense.' },
  seam: { group: 'Deep', note: 'Win the middle of the field and stay vertical between the safeties.' },
  fade: { group: 'Deep', note: 'Release outside, stack the defender and track the ball over the shoulder.' },
  drag: { group: 'Intermediate', note: 'Cross the formation behind the linebackers and keep working to open grass.' },
  mesh: { group: 'Intermediate', note: 'A shallow cross that intersects the drag and rubs coverage.' },
  texas: { group: 'Intermediate', note: 'Sit behind the linebackers, then work to the open window.' },
  angle: { group: 'Intermediate', note: 'A short out-and-up that attacks the flat defender.' },
}

/** Alias kept for callers that only need the shape of a drawable route. */
export type RouteLibraryEntry = LibraryRoute

export type { RoutePreset }

const LIBRARY_ORDER = [
  'hitch',
  'slant',
  'out',
  'flat',
  'swing',
  'curl',
  'comeback',
  'dig',
  'drag',
  'mesh',
  'texas',
  'angle',
  'post',
  'corner',
  'go',
  'wheel',
  'seam',
  'fade',
]

const groupOrder = (group: RouteGroup) => ROUTE_GROUPS.indexOf(group)
const routeOrder = (id: string) => {
  const index = LIBRARY_ORDER.indexOf(id)
  return index === -1 ? LIBRARY_ORDER.length : index
}

export const DEFAULT_ROUTE_LIBRARY: LibraryRoute[] = ROUTE_PRESETS.map((preset) => {
  const meta = META[preset.id] ?? { group: 'Intermediate' as RouteGroup, note: '' }
  return {
    id: preset.id,
    name: preset.name,
    points: preset.points.map((point) => ({ ...point })),
    group: meta.group,
    color: ROUTE_GROUP_COLORS[meta.group],
    note: meta.note,
  }
}).sort(
  (a, b) => groupOrder(a.group) - groupOrder(b.group) || routeOrder(a.id) - routeOrder(b.id),
)

/** Older screens and tests expect this name; it is the default library. */
export const ROUTE_LIBRARY = DEFAULT_ROUTE_LIBRARY

export const cloneRouteLibrary = (
  routes: LibraryRoute[] = DEFAULT_ROUTE_LIBRARY,
): LibraryRoute[] =>
  routes.map((route) => ({
    ...route,
    points: route.points.map((point) => ({ ...point })),
  }))

export const routeGroupColor = (group: RouteGroup) => ROUTE_GROUP_COLORS[group]

export const routeDepth = (points: RoutePreset['points']) =>
  Math.max(...points.map((point) => point.y))

export const routeBreak = (points: RoutePreset['points']) =>
  points.length > 1 ? points[0].y : null

export function formatRouteBreak(points: RoutePreset['points']) {
  const breakDepth = routeBreak(points)
  if (breakDepth === null) return 'Single stem'
  if (breakDepth < 0) return 'Release behind LOS'
  return `Break at ${breakDepth} yd`
}

/** Route names are unique case-insensitively, so a copy gets a free one. */
export function uniqueRouteName(base: string, names: string[]): string {
  const used = new Set(names.map((name) => name.trim().toLowerCase()))
  const cleaned = base.trim() || 'New route'
  if (!used.has(cleaned.toLowerCase())) return cleaned
  let suffix = 2
  while (used.has(`${cleaned} ${suffix}`.toLowerCase())) suffix += 1
  return `${cleaned} ${suffix}`
}

/** An editable copy of a library route, with its own id and point objects. */
export function cloneLibraryRoute(
  route: LibraryRoute,
  existingNames: string[],
): LibraryRoute {
  return {
    ...route,
    id: createId(),
    name: uniqueRouteName(`${route.name} copy`, existingNames),
    points: route.points.map((point) => ({ ...point })),
  }
}
