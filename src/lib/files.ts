import type {
  Category,
  Formation,
  LibraryRoute,
  Play,
  Playbook,
  Player,
  RouteGroup,
  RoutePoint,
} from '../types'
import { createId } from '../types'
import {
  DEFAULT_ROUTE_LIBRARY,
  ROUTE_GROUPS,
  cloneRouteLibrary,
  routeGroupColor,
} from '../data/routeLibrary'

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'snapbook'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  downloadBlob(new Blob([bytes as BlobPart], { type }), filename)
}

export const SNAPBOOK_FORMAT = 'snapbook'
/** Schema revision written by this build. */
export const SNAPBOOK_VERSION = 3
/** Highest schema revision this build knows how to read. */
export const SNAPBOOK_READER_VERSION = 3
/**
 * The oldest reader that can safely understand the files this build writes.
 * Additive fields can be ignored by older readers; a change that would lose
 * meaningful data must raise this so those readers refuse the file.
 */
export const SNAPBOOK_MIN_READER_VERSION = 2

interface FilePoint {
  x: number
  y: number
  curve?: number
}

interface FilePlayer {
  label: string
  role: string
  number?: number | null
  color: string
  x: number
  y: number
}

interface FileFormation {
  name: string
  players: FilePlayer[]
}

interface FileTag {
  name: string
  color: string
}

interface FileRoute {
  name: string
  group: RouteGroup
  color: string
  note?: string
  points: FilePoint[]
}

/** A branch that leaves a route at one of its points. */
interface FileRouteOption {
  from: number
  points: FilePoint[]
}

interface FilePlay {
  name: string
  code?: string
  formation: string
  tags?: string[]
  notes?: string
  updatedAt?: string
  routes?: Record<string, FilePoint[]>
  motions?: Record<string, FilePoint[]>
  optionRoutes?: Record<string, FileRouteOption[]>
  lineup?: Record<string, Partial<FilePlayer>>
}

export interface SnapbookFile {
  format: typeof SNAPBOOK_FORMAT
  version: number
  minReaderVersion: number
  exportedAt: string
  playbook: {
    name: string
    team: string
    level: Playbook['level']
    tags: FileTag[]
    formations: FileFormation[]
    routes: FileRoute[]
    plays: FilePlay[]
  }
}

const round = (value: number) => Math.round(value * 100) / 100

function uniqueNames(names: string[], fallback: string): string[] {
  const used = new Set<string>()
  return names.map((name, index) => {
    const base = name.trim() || `${fallback} ${index + 1}`
    let candidate = base
    let suffix = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base} (${suffix})`
      suffix += 1
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}

function playerKeys(players: Array<{ label: string; role: string }>): string[] {
  const used = new Set<string>()
  return players.map((player) => {
    const base = player.label.trim() || player.role.trim() || 'Player'
    let key = base
    let suffix = 2
    while (used.has(key.toLowerCase())) {
      key = `${base} #${suffix}`
      suffix += 1
    }
    used.add(key.toLowerCase())
    return key
  })
}

const filePlayer = (player: Player): FilePlayer => ({
  label: player.label,
  role: player.role,
  ...(player.number === null ? {} : { number: player.number }),
  color: player.color,
  x: round(player.pos.x),
  y: round(player.pos.y),
})

const filePoints = (points: RoutePoint[]): FilePoint[] =>
  points.map((point) => ({
    x: round(point.x),
    y: round(point.y),
    ...(point.curve ? { curve: round(point.curve) } : {}),
  }))

function lineupPatch(base: Player, player: Player): Partial<FilePlayer> {
  const patch: Partial<FilePlayer> = {}
  if (player.label !== base.label) patch.label = player.label
  if (player.role !== base.role) patch.role = player.role
  if (player.number !== base.number) patch.number = player.number
  if (player.color !== base.color) patch.color = player.color
  if (round(player.pos.x) !== round(base.pos.x)) patch.x = round(player.pos.x)
  if (round(player.pos.y) !== round(base.pos.y)) patch.y = round(player.pos.y)
  return patch
}

export function createSnapbookFile(
  playbook: Playbook,
  exportedAt = new Date().toISOString(),
): SnapbookFile {
  const formationNames = uniqueNames(playbook.formations.map((item) => item.name), 'Formation')
  const tagNames = uniqueNames(playbook.categories.map((item) => item.name), 'Tag')
  const routeNames = uniqueNames(playbook.routes.map((item) => item.name), 'Route')
  const formationsById = new Map(playbook.formations.map((item) => [item.id, item]))
  const formationNamesById = new Map(
    playbook.formations.map((item, index) => [item.id, formationNames[index]]),
  )
  const tagNamesById = new Map(
    playbook.categories.map((item, index) => [item.id, tagNames[index]]),
  )

  return {
    format: SNAPBOOK_FORMAT,
    version: SNAPBOOK_VERSION,
    minReaderVersion: SNAPBOOK_MIN_READER_VERSION,
    exportedAt,
    playbook: {
      name: playbook.name,
      team: playbook.team,
      level: playbook.level,
      tags: playbook.categories.map((item, index) => ({
        name: tagNames[index],
        color: item.color,
      })),
      formations: playbook.formations.map((formation, index) => ({
        name: formationNames[index],
        players: formation.players.map(filePlayer),
      })),
      routes: playbook.routes.map((route, index) => ({
        name: routeNames[index],
        group: route.group,
        color: route.color,
        ...(route.note.trim() ? { note: route.note } : {}),
        points: filePoints(route.points),
      })),
      plays: playbook.plays.map((play) => {
        const formation = formationsById.get(play.formationId)
        if (!formation) {
          throw new Error(`Cannot export “${play.name}”: its formation is missing.`)
        }
        if (play.players.length !== formation.players.length) {
          throw new Error(
            `Cannot export “${play.name}”: its lineup does not match “${formation.name}”.`,
          )
        }

        const keys = playerKeys(formation.players)
        const routes: Record<string, FilePoint[]> = {}
        const motions: Record<string, FilePoint[]> = {}
        const optionRoutes: Record<string, FileRouteOption[]> = {}
        const lineup: Record<string, Partial<FilePlayer>> = {}

        play.players.forEach((player, index) => {
          const key = keys[index]
          if (player.route?.points.length) {
            routes[key] = filePoints(player.route.points)
            // A branch must leave a route point that the file still carries.
            const options = (player.route.options ?? []).filter(
              (option) =>
                Number.isInteger(option.from) &&
                option.from >= 0 &&
                option.from < player.route!.points.length &&
                option.points.length > 0,
            )
            if (options.length) {
              optionRoutes[key] = options.map((option) => ({
                from: option.from,
                points: filePoints(option.points),
              }))
            }
          }
          if (player.motion?.points.length) motions[key] = filePoints(player.motion.points)
          const patch = lineupPatch(formation.players[index], player)
          if (Object.keys(patch).length) lineup[key] = patch
        })

        const tags = play.categories
          .map((id) => tagNamesById.get(id))
          .filter((name): name is string => Boolean(name))

        return {
          name: play.name,
          ...(play.codeName ? { code: play.codeName } : {}),
          formation: formationNamesById.get(formation.id) ?? formation.name,
          ...(tags.length ? { tags } : {}),
          ...(play.notes.trim() ? { notes: play.notes } : {}),
          ...(play.updatedAt ? { updatedAt: play.updatedAt } : {}),
          ...(Object.keys(routes).length ? { routes } : {}),
          ...(Object.keys(motions).length ? { motions } : {}),
          ...(Object.keys(optionRoutes).length ? { optionRoutes } : {}),
          ...(Object.keys(lineup).length ? { lineup } : {}),
        }
      }),
    },
  }
}

export function serializeSnapbook(
  playbook: Playbook,
  exportedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify(createSnapbookFile(playbook, exportedAt), null, 2)}\n`
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function asRecord(value: unknown, message: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(message)
  return value
}

function asArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message)
  return value
}

function asString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message)
  return value
}

function asNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message)
  return value
}

function parseFilePoints(value: unknown, message: string): RoutePoint[] {
  return asArray(value, `${message} must be a list of route points.`).map((entry, index) => {
    const point = asRecord(entry, `${message} point ${index + 1} is malformed.`)
    return {
      x: asNumber(point.x, `${message} point ${index + 1} is missing x.`),
      y: asNumber(point.y, `${message} point ${index + 1} is missing y.`),
      ...(point.curve === undefined
        ? {}
        : { curve: asNumber(point.curve, `${message} point ${index + 1} has an invalid curve.`) }),
    }
  })
}

function parseFileRoutes(value: unknown): LibraryRoute[] {
  if (value === undefined) return cloneRouteLibrary(DEFAULT_ROUTE_LIBRARY)

  const usedNames = new Set<string>()
  return asArray(value, 'The route library is malformed.').map((entry, index) => {
    const route = asRecord(entry, `Route ${index + 1} is malformed.`)
    const name = asString(route.name, `Route ${index + 1} is missing a name.`).trim()
    if (!name) throw new Error(`Route ${index + 1} is missing a name.`)
    const key = name.toLowerCase()
    if (usedNames.has(key)) {
      throw new Error(`The route library has two routes named “${name}”.`)
    }
    usedNames.add(key)

    const groupValue = route.group
    const group: RouteGroup =
      typeof groupValue === 'string' && ROUTE_GROUPS.includes(groupValue as RouteGroup)
        ? (groupValue as RouteGroup)
        : 'Intermediate'
    const points = parseFilePoints(route.points, `Route “${name}”`)
    if (!points.length) throw new Error(`Route “${name}” has no points.`)

    return {
      id: createId(),
      name,
      group,
      color: typeof route.color === 'string' ? route.color : routeGroupColor(group),
      note: typeof route.note === 'string' ? route.note : '',
      points,
    }
  })
}

function fileVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

/**
 * Version negotiation keeps old backups readable and lets a newer writer
 * declare that its additions are safe for this reader. Unknown fields are
 * ignored by the parsers; `minReaderVersion` is reserved for changes that
 * cannot be ignored without losing data.
 */
function assertReadableSnapbookVersion(file: UnknownRecord) {
  const version = fileVersion(file.version)
  if (version === null) {
    throw new Error(
      `Unsupported Snapbook file version: ${String(file.version ?? 'missing')}.`,
    )
  }
  if (version < 2) {
    throw new Error(`Unsupported Snapbook file version: ${version}.`)
  }

  const declaredMinReader =
    file.minReaderVersion === undefined ? version : fileVersion(file.minReaderVersion)
  if (declaredMinReader === null) {
    throw new Error(
      `Unsupported Snapbook minimum reader version: ${String(file.minReaderVersion)}.`,
    )
  }
  if (declaredMinReader > version) {
    throw new Error('The Snapbook compatibility metadata is inconsistent.')
  }
  if (declaredMinReader > SNAPBOOK_READER_VERSION) {
    throw new Error(
      `This Snapbook file needs app version ${declaredMinReader} or newer; this build reads up to version ${SNAPBOOK_READER_VERSION}.`,
    )
  }
}

function parseSnapbookV2(raw: UnknownRecord): Playbook {
  const root = asRecord(raw.playbook, 'The playbook is missing.')
  const name = asString(root.name, 'The playbook name is missing.')
  const team = typeof root.team === 'string' ? root.team : ''
  const levelValue = typeof root.level === 'string' ? root.level.toLowerCase() : '5v5'
  if (levelValue !== '5v5' && levelValue !== '7v7') {
    throw new Error(
      `This playbook uses the unsupported field size “${String(root.level)}”; it may need a newer version of Snapbook.`,
    )
  }
  const level: Playbook['level'] = levelValue === '7v7' ? '7v7' : '5v5'

  const tagEntries = root.tags === undefined ? [] : asArray(root.tags, 'The tags list is malformed.')
  const usedTagNames = new Set<string>()
  const categories: Category[] = tagEntries.map((entry, index) => {
    const tag = asRecord(entry, `Tag ${index + 1} is malformed.`)
    const tagName = asString(tag.name, `Tag ${index + 1} is missing a name.`)
    const tagKey = tagName.trim().toLowerCase()
    if (usedTagNames.has(tagKey)) {
      throw new Error(`The playbook has two tags named “${tagName}”.`)
    }
    usedTagNames.add(tagKey)
    return {
      id: createId(),
      name: tagName,
      color: typeof tag.color === 'string' ? tag.color : '#F4C95D',
    }
  })
  const categoriesByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category]),
  )

  const routes = parseFileRoutes(root.routes)

  const formationEntries =
    root.formations === undefined
      ? []
      : asArray(root.formations, 'The formations list is malformed.')
  if (!formationEntries.length) throw new Error('This playbook has no formations.')

  const usedFormationNames = new Set<string>()
  const formations: Formation[] = formationEntries.map((entry, index) => {
    const formation = asRecord(entry, `Formation ${index + 1} is malformed.`)
    const formationName = asString(formation.name, `Formation ${index + 1} is missing a name.`)
    const formationKey = formationName.trim().toLowerCase()
    if (usedFormationNames.has(formationKey)) {
      throw new Error(`The playbook has two formations named “${formationName}”.`)
    }
    usedFormationNames.add(formationKey)
    const playerEntries = asArray(
      formation.players,
      `Formation “${formationName}” is missing its players.`,
    )
    if (!playerEntries.length) {
      throw new Error(`Formation “${formationName}” has no players.`)
    }

    return {
      id: createId(),
      name: formationName,
      players: playerEntries.map((playerEntry, playerIndex) => {
        const player = asRecord(
          playerEntry,
          `Player ${playerIndex + 1} in “${formationName}” is malformed.`,
        )
        const label = typeof player.label === 'string' ? player.label : ''
        return {
          id: createId(),
          label,
          role: typeof player.role === 'string' ? player.role : label,
          number:
            typeof player.number === 'number' && Number.isFinite(player.number)
              ? player.number
              : null,
          color: typeof player.color === 'string' ? player.color : '#F1EEE4',
          pos: {
            x: asNumber(player.x, `Player ${playerIndex + 1} in “${formationName}” is missing x.`),
            y: asNumber(player.y, `Player ${playerIndex + 1} in “${formationName}” is missing y.`),
          },
          route: null,
        }
      }),
    }
  })
  const formationsByName = new Map(formations.map((formation) => [formation.name, formation]))

  const playEntries =
    root.plays === undefined ? [] : asArray(root.plays, 'The plays list is malformed.')

  const plays: Play[] = playEntries.map((entry, index) => {
    const play = asRecord(entry, `Play ${index + 1} is malformed.`)
    const playName = asString(play.name, `Play ${index + 1} is missing a name.`)
    const formationName = asString(
      play.formation,
      `Play “${playName}” is missing its formation.`,
    )
    const formation = formationsByName.get(formationName)
    if (!formation) {
      throw new Error(`Play “${playName}” uses the unknown formation “${formationName}”.`)
    }

    const keys = playerKeys(formation.players)
    const keyIndexes = new Map(keys.map((key, keyIndex) => [key, keyIndex]))
    const players: Player[] = formation.players.map((base) => ({
      ...base,
      id: createId(),
      pos: { ...base.pos },
      route: null,
    }))

    const lineup = play.lineup === undefined ? {} : asRecord(play.lineup, `The lineup for “${playName}” is malformed.`)
    for (const [key, value] of Object.entries(lineup)) {
      const playerIndex = keyIndexes.get(key)
      if (playerIndex === undefined) {
        throw new Error(`Play “${playName}” changes the unknown player “${key}”.`)
      }
      const patch = asRecord(value, `The change to “${key}” in “${playName}” is malformed.`)
      const player = players[playerIndex]

      if (patch.label !== undefined) {
        player.label = asString(patch.label, `The label for “${key}” in “${playName}” must be text.`)
      }
      if (patch.role !== undefined) {
        player.role = asString(patch.role, `The role for “${key}” in “${playName}” must be text.`)
      }
      if (patch.number !== undefined) {
        player.number =
          patch.number === null
            ? null
            : asNumber(patch.number, `The number for “${key}” in “${playName}” must be a number.`)
      }
      if (patch.color !== undefined) {
        player.color = asString(patch.color, `The color for “${key}” in “${playName}” must be text.`)
      }
      if (patch.x !== undefined || patch.y !== undefined) {
        player.pos = {
          x:
            patch.x === undefined
              ? player.pos.x
              : asNumber(patch.x, `The x position for “${key}” in “${playName}” must be a number.`),
          y:
            patch.y === undefined
              ? player.pos.y
              : asNumber(patch.y, `The y position for “${key}” in “${playName}” must be a number.`),
        }
      }
    }

    const routes = play.routes === undefined ? {} : asRecord(play.routes, `The routes for “${playName}” are malformed.`)
    for (const [key, value] of Object.entries(routes)) {
      const playerIndex = keyIndexes.get(key)
      if (playerIndex === undefined) {
        throw new Error(`Play “${playName}” has a route for the unknown player “${key}”.`)
      }
      const points = parseFilePoints(value, `The route for “${key}” in “${playName}”`)
      if (points.length) players[playerIndex].route = { id: createId(), points }
    }

    const motions =
      play.motions === undefined
        ? {}
        : asRecord(play.motions, `The motions for “${playName}” are malformed.`)
    for (const [key, value] of Object.entries(motions)) {
      const playerIndex = keyIndexes.get(key)
      if (playerIndex === undefined) {
        throw new Error(`Play “${playName}” has a motion for the unknown player “${key}”.`)
      }
      const points = parseFilePoints(value, `The motion for “${key}” in “${playName}”`)
      if (points.length) players[playerIndex].motion = { id: createId(), points }
    }

    const optionRoutes =
      play.optionRoutes === undefined
        ? {}
        : asRecord(
            play.optionRoutes,
            `The option routes for “${playName}” are malformed.`,
          )
    for (const [key, value] of Object.entries(optionRoutes)) {
      const playerIndex = keyIndexes.get(key)
      if (playerIndex === undefined) {
        throw new Error(
          `Play “${playName}” has an option route for the unknown player “${key}”.`,
        )
      }
      const route = players[playerIndex].route
      if (!route) {
        throw new Error(
          `Play “${playName}” has an option route for “${key}”, who has no route.`,
        )
      }
      const entries = asArray(
        value,
        `The option routes for “${key}” in “${playName}” must be a list.`,
      )
      const options = entries.flatMap((entry, optionIndex) => {
        const message = `Option ${optionIndex + 1} for “${key}” in “${playName}”`
        const option = asRecord(entry, `${message} is malformed.`)
        const from = option.from
        if (typeof from !== 'number' || !Number.isInteger(from)) {
          throw new Error(`${message} is missing a route point to branch from.`)
        }
        if (from < 0 || from >= route.points.length) {
          throw new Error(`${message} branches from a point the route does not have.`)
        }
        const points = parseFilePoints(option.points, message)
        if (!points.length) return []
        return [{ id: createId(), from, points }]
      })
      if (options.length) route.options = options
    }

    const tags = play.tags === undefined ? [] : asArray(play.tags, `The tags for “${playName}” are malformed.`)
    const categoryIds = tags.map((tag) => {
      const tagName = asString(tag, `A tag on “${playName}” must be text.`)
      const category = categoriesByName.get(tagName.toLowerCase())
      if (!category) {
        throw new Error(`Play “${playName}” uses the unknown tag “${tagName}”.`)
      }
      return category.id
    })

    const updatedAt =
      typeof play.updatedAt === 'string' && !Number.isNaN(Date.parse(play.updatedAt))
        ? new Date(play.updatedAt).toISOString()
        : new Date().toISOString()

    return {
      id: createId(),
      name: playName,
      codeName: typeof play.code === 'string' ? play.code : '',
      formationId: formation.id,
      players,
      categories: Array.from(new Set(categoryIds)),
      notes: typeof play.notes === 'string' ? play.notes : '',
      createdAt: updatedAt,
      updatedAt,
    }
  })

  return {
    id: createId(),
    name,
    team,
    level,
    formations,
    categories,
    routes,
    plays,
  }
}

export function parseSnapbook(text: string): Playbook {
  // A UTF-8 BOM is legal in interchange files but JSON.parse rejects it.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isRecord(parsed) || !Object.keys(parsed).length) {
    throw new Error('That file is empty.')
  }

  if (parsed.format === SNAPBOOK_FORMAT) {
    assertReadableSnapbookVersion(parsed)
    return parseSnapbookV2(parsed)
  }

  if (typeof parsed.format === 'string' && parsed.format !== 'snapbook.v1') {
    throw new Error(`Unsupported Snapbook file format: ${parsed.format}.`)
  }

  const candidate = isRecord(parsed.playbook) ? parsed.playbook : parsed
  if (
    !isRecord(candidate) ||
    !Array.isArray(candidate.plays) ||
    !Array.isArray(candidate.formations) ||
    !Array.isArray(candidate.categories)
  ) {
    throw new Error('This does not look like a Snapbook playbook file.')
  }
  const legacy = candidate as unknown as Playbook
  return {
    ...legacy,
    routes: Array.isArray(legacy.routes) ? legacy.routes : cloneRouteLibrary(),
  }
}

export function exportNative(playbook: Playbook) {
  downloadBlob(
    new Blob([serializeSnapbook(playbook)], { type: 'application/json' }),
    `${slugify(playbook.name)}.snapbook.json`,
  )
}

export async function importNative(file: File): Promise<Playbook> {
  const text = await file.text()
  return parseSnapbook(text)
}

export const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
