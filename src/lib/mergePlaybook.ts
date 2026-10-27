import {
  createId,
  type Category,
  type Formation,
  type LibraryRoute,
  type Play,
  type Playbook,
  type Player,
  type RouteOption,
  type RoutePoint,
} from '../types'

export interface MergeCounts {
  plays: number
  formations: number
  routes: number
  tags: number
}

export interface MergeResult {
  playbook: Playbook
  added: MergeCounts
  /** Exact duplicate plays that were already present and therefore skipped. */
  skipped: number
}

const nameKey = (value: string) => value.trim().toLowerCase()

const cleanName = (value: string, fallback: string) => value.trim() || fallback

/** Adds "(shared)" and a counter only when the name is already taken. */
function availableName(base: string, used: Set<string>): string {
  const cleaned = base.trim() || 'Untitled'
  if (!used.has(nameKey(cleaned))) return cleaned

  const sharedName = `${cleaned} (shared)`
  if (!used.has(nameKey(sharedName))) return sharedName

  let suffix = 2
  while (used.has(nameKey(`${cleaned} (shared ${suffix})`))) suffix += 1
  return `${cleaned} (shared ${suffix})`
}

const samePoints = (left: RoutePoint[], right: RoutePoint[]) =>
  left.length === right.length &&
  left.every((point, index) => {
    const other = right[index]
    return (
      point.x === other.x &&
      point.y === other.y &&
      (point.curve ?? 0) === (other.curve ?? 0)
    )
  })

const sameAlignment = (left: Formation, right: Formation) =>
  left.players.length === right.players.length &&
  left.players.every((player, index) => {
    const other = right.players[index]
    if (!other) return false
    return (
      player.label === other.label &&
      player.role === other.role &&
      player.pos.x === other.pos.x &&
      player.pos.y === other.pos.y
    )
  })

const clonePoints = (points: RoutePoint[]): RoutePoint[] =>
  points.map((point) => ({ ...point }))

const cloneRouteOptions = (options: RouteOption[] | undefined): RouteOption[] | undefined =>
  options?.length
    ? options.map((option) => ({
        id: createId(),
        from: option.from,
        points: clonePoints(option.points),
      }))
    : undefined

const clonePlayer = (player: Player, keepRoute: boolean): Player => ({
  ...player,
  id: createId(),
  pos: { ...player.pos },
  route:
    keepRoute && player.route
      ? {
          id: createId(),
          points: clonePoints(player.route.points),
          ...(player.route.options?.length
            ? { options: cloneRouteOptions(player.route.options) }
            : {}),
        }
      : null,
  motion:
    keepRoute && player.motion
      ? { id: createId(), points: clonePoints(player.motion.points) }
      : null,
})

const cloneFormation = (formation: Formation, name: string): Formation => ({
  id: createId(),
  name,
  players: formation.players.map((player) => clonePlayer(player, false)),
})

/**
 * Captures everything that makes a play distinct in the UI. Local ids and
 * timestamps are ignored, and formation/tag references are compared by name.
 */
const playFingerprint = (
  play: Play,
  formationName: string,
  categoryNames: string[],
): string =>
  JSON.stringify({
    name: play.name,
    codeName: play.codeName,
    formation: nameKey(formationName),
    tags: categoryNames.map(nameKey).sort(),
    notes: play.notes,
    players: play.players.map((player) => ({
      label: player.label,
      role: player.role,
      number: player.number,
      color: player.color,
      pos: [player.pos.x, player.pos.y],
      route: player.route?.points.length
        ? {
            points: player.route.points.map((point) => [point.x, point.y, point.curve ?? 0]),
            options: (player.route.options ?? []).map((option) => ({
              from: option.from,
              points: option.points.map((point) => [point.x, point.y, point.curve ?? 0]),
            })),
          }
        : null,
      motion: player.motion?.points.length
        ? player.motion.points.map((point) => [point.x, point.y, point.curve ?? 0])
        : null,
    })),
  })

/**
 * Adds every shared play to the target playbook. Formations, tags and routes
 * are matched by name where possible; anything that would collide with a
 * different local definition is added under a "(shared)" name with fresh ids.
 * The target playbook's name, team, level and existing plays stay untouched.
 */
export function mergeSharedPlaybook(target: Playbook, shared: Playbook): MergeResult {
  const categories: Category[] = target.categories.map((category) => ({ ...category }))
  const categoryByName = new Map(
    categories.map((category) => [nameKey(category.name), category]),
  )
  const categoryIdMap = new Map<string, string>()
  let tagsAdded = 0

  for (const category of shared.categories) {
    const name = cleanName(category.name, 'Tag')
    const existing = categoryByName.get(nameKey(name))
    if (existing) {
      categoryIdMap.set(category.id, existing.id)
      continue
    }
    const created: Category = { id: createId(), name, color: category.color }
    categories.push(created)
    categoryByName.set(nameKey(name), created)
    categoryIdMap.set(category.id, created.id)
    tagsAdded += 1
  }

  const routes: LibraryRoute[] = target.routes.map((route) => ({
    ...route,
    points: clonePoints(route.points),
  }))
  const routeByName = new Map(routes.map((route) => [nameKey(route.name), route]))
  const usedRouteNames = new Set(routes.map((route) => nameKey(route.name)))
  let routesAdded = 0

  for (const route of shared.routes) {
    const key = nameKey(route.name)
    const existing = routeByName.get(key)
    if (existing && samePoints(existing.points, route.points)) continue

    const name = availableName(route.name, usedRouteNames)
    const created: LibraryRoute = {
      ...route,
      id: createId(),
      name,
      points: clonePoints(route.points),
    }
    routes.push(created)
    routeByName.set(nameKey(name), created)
    usedRouteNames.add(nameKey(name))
    routesAdded += 1
  }

  const formations: Formation[] = target.formations.map((formation) => ({
    ...formation,
    players: formation.players.map((player) => ({
      ...player,
      pos: { ...player.pos },
    })),
  }))
  const formationByName = new Map(
    formations.map((formation) => [nameKey(formation.name), formation]),
  )
  const usedFormationNames = new Set(formations.map((formation) => nameKey(formation.name)))
  const formationIdMap = new Map<string, string>()
  let formationsAdded = 0

  for (const formation of shared.formations) {
    const existing = formationByName.get(nameKey(formation.name))
    if (existing && sameAlignment(existing, formation)) {
      formationIdMap.set(formation.id, existing.id)
      continue
    }

    const name = availableName(formation.name, usedFormationNames)
    const created = cloneFormation(formation, name)
    formations.push(created)
    formationByName.set(nameKey(name), created)
    usedFormationNames.add(nameKey(name))
    formationIdMap.set(formation.id, created.id)
    formationsAdded += 1
  }

  const formationNameById = new Map(
    formations.map((formation) => [formation.id, formation.name]),
  )
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  )
  const existingFingerprints = new Set(
    target.plays.map((play) =>
      playFingerprint(
        play,
        formationNameById.get(play.formationId) ?? '',
        play.categories.map((id) => categoryNameById.get(id) ?? ''),
      ),
    ),
  )
  const usedPlayNames = new Set(target.plays.map((play) => nameKey(play.name)))
  const addedPlays: Play[] = []
  let skipped = 0
  // Imported plays should surface at the top of the playbook's recent-first list.
  const mergedAt = new Date().toISOString()

  for (const play of shared.plays) {
    const formationId = formationIdMap.get(play.formationId)
    if (!formationId) {
      throw new Error(`Cannot merge “${play.name}”: its formation is missing.`)
    }

    const fingerprint = playFingerprint(
      play,
      formationNameById.get(formationId) ?? '',
      play.categories
        .map((id) => categoryNameById.get(categoryIdMap.get(id) ?? '') ?? '')
        .filter(Boolean),
    )
    if (existingFingerprints.has(fingerprint)) {
      skipped += 1
      continue
    }
    existingFingerprints.add(fingerprint)

    const name = availableName(play.name, usedPlayNames)
    usedPlayNames.add(nameKey(name))

    const categoriesForPlay = Array.from(
      new Set(
        play.categories
          .map((id) => categoryIdMap.get(id))
          .filter((id): id is string => Boolean(id)),
      ),
    )

    addedPlays.push({
      ...play,
      id: createId(),
      name,
      formationId,
      players: play.players.map((player) => clonePlayer(player, true)),
      categories: categoriesForPlay,
      updatedAt: mergedAt,
    })
  }

  return {
    playbook: {
      ...target,
      formations,
      categories,
      routes,
      plays: [...target.plays, ...addedPlays],
    },
    added: {
      plays: addedPlays.length,
      formations: formationsAdded,
      routes: routesAdded,
      tags: tagsAdded,
    },
    skipped,
  }
}
