import { createSnapbookFile, parseSnapbook } from './files'
import { playbookHash } from './syncLogic'
import { createId, type Playbook } from '../types'

/**
 * A playbook library is what lives on disk in Dropbox: one readable document
 * holding every playbook. Each entry keeps the playbook's id next to a normal
 * Snapbook file, so the library survives a round trip without renaming
 * anything and plays stay identified by their names inside each playbook.
 */
export const LIBRARY_FORMAT = 'snapbook.library'
export const LIBRARY_VERSION = 1
const LEGACY_ID = 'legacy-playbook'

export interface LibraryEntryFile {
  id: string
  file: unknown
}

export interface ParsedLibrary {
  playbooks: Playbook[]
  /** True when the source was a single-playbook file written before libraries. */
  legacy: boolean
}

export interface LibraryMergeConflict {
  id: string
  local: Playbook
  remote: Playbook
}

export interface LibraryMerge {
  playbooks: Playbook[]
  conflicts: LibraryMergeConflict[]
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function createLibraryFile(
  playbooks: Playbook[],
  exportedAt = new Date().toISOString(),
) {
  return {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    exportedAt,
    playbooks: playbooks.map((playbook): LibraryEntryFile => ({
      id: playbook.id,
      file: createSnapbookFile(playbook, exportedAt),
    })),
  }
}

export function serializeLibrary(
  playbooks: Playbook[],
  exportedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify(createLibraryFile(playbooks, exportedAt), null, 2)}\n`
}

export function parseLibrary(text: string): ParsedLibrary {
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

  if (parsed.format !== LIBRARY_FORMAT) {
    // Written before the library existed: one playbook, no id of its own.
    const playbook = parseSnapbook(source)
    return { playbooks: [{ ...playbook, id: LEGACY_ID }], legacy: true }
  }

  if (!Array.isArray(parsed.playbooks)) {
    throw new Error('This library file has no playbooks.')
  }

  const seen = new Set<string>()
  const playbooks = parsed.playbooks.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id) {
      throw new Error(`Playbook ${index + 1} in this library file has no id.`)
    }
    if (seen.has(entry.id)) {
      throw new Error('This library file lists the same playbook twice.')
    }
    seen.add(entry.id)
    return { ...parseSnapbook(JSON.stringify(entry.file)), id: entry.id }
  })

  return { playbooks, legacy: false }
}

/** Stable across devices: ids identify playbooks, content decides equality. */
export function libraryHash(playbooks: Playbook[]): string {
  return baselineHash(
    Object.fromEntries(playbooks.map((playbook) => [playbook.id, playbookHash(playbook)])),
  )
}

export function baselineHash(baseline: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(baseline).sort(([left], [right]) => left.localeCompare(right)),
  )
}

/**
 * Three-way merge of the local library with the Dropbox copy, using the hashes
 * recorded at the last successful sync. A playbook that only one side touched
 * follows that side; a playbook both sides changed is reported as a conflict
 * and left with its local content until the user decides.
 */
export function mergeLibraries({
  local,
  remote,
  baseline,
}: {
  local: Playbook[]
  remote: Playbook[]
  baseline: Record<string, string>
}): LibraryMerge {
  const localById = new Map(local.map((playbook) => [playbook.id, playbook]))
  const remoteById = new Map(remote.map((playbook) => [playbook.id, playbook]))
  const localHashes = new Map(
    local.map((playbook) => [playbook.id, playbookHash(playbook)] as const),
  )

  // Two devices that never synced can each hold the same starter playbook
  // under a different local id. Identical content is the same playbook, so
  // adopt the local entry instead of adding a duplicate.
  const aliased = new Set<string>()
  const paired = new Set<string>()
  for (const remotePlaybook of remote) {
    if (localById.has(remotePlaybook.id)) continue
    if (baseline[remotePlaybook.id]) continue
    const remoteHash = playbookHash(remotePlaybook)
    const match = local.find(
      (playbook) =>
        !paired.has(playbook.id) &&
        !baseline[playbook.id] &&
        localHashes.get(playbook.id) === remoteHash,
    )
    if (!match) continue
    paired.add(match.id)
    aliased.add(remotePlaybook.id)
  }

  const order = [
    ...local.map((playbook) => playbook.id),
    ...remote
      .filter((playbook) => !localById.has(playbook.id) && !aliased.has(playbook.id))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((playbook) => playbook.id),
  ]

  const playbooks: Playbook[] = []
  const conflicts: LibraryMergeConflict[] = []

  for (const id of order) {
    const localPlaybook = localById.get(id)
    const remotePlaybook = remoteById.get(id)
    const baseHash = baseline[id] ?? null
    const localHash = localPlaybook ? (localHashes.get(id) ?? null) : null
    const remoteHash = remotePlaybook ? playbookHash(remotePlaybook) : null

    if (localPlaybook && remotePlaybook) {
      if (localHash === remoteHash) {
        playbooks.push(localPlaybook)
        continue
      }
      const localChanged = localHash !== baseHash
      const remoteChanged = remoteHash !== baseHash
      if (!localChanged && remoteChanged) {
        playbooks.push(remotePlaybook)
        continue
      }
      if (localChanged && !remoteChanged) {
        playbooks.push(localPlaybook)
        continue
      }
      conflicts.push({ id, local: localPlaybook, remote: remotePlaybook })
      playbooks.push(localPlaybook)
      continue
    }

    if (localPlaybook) {
      // Missing remotely: deleted on the other device, or never uploaded.
      if (baseHash && localHash === baseHash) continue
      playbooks.push(localPlaybook)
      continue
    }

    if (remotePlaybook) {
      // Missing locally: deleted here, or added on the other device.
      if (baseHash && remoteHash === baseHash) continue
      playbooks.push(remotePlaybook)
    }
  }

  return { playbooks, conflicts }
}

/** Resolves every conflict the same way, returning the library to store. */
export function applyMergeChoice(merge: LibraryMerge, choice: 'local' | 'remote'): Playbook[] {
  if (!merge.conflicts.length) return merge.playbooks
  const chosen = new Map(
    merge.conflicts.map((conflict) => [
      conflict.id,
      choice === 'local' ? conflict.local : conflict.remote,
    ]),
  )
  return merge.playbooks.map((playbook) => chosen.get(playbook.id) ?? playbook)
}

export function uniquePlaybookName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()))
  const stem = base.trim() || 'Playbook'
  if (!taken.has(stem.toLowerCase())) return stem
  for (let index = 2; index < 500; index += 1) {
    const candidate = `${stem} ${index}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${stem} ${Date.now()}`
}

/** Deep copy with fresh ids, so library entries never share object identity. */
export function clonePlaybook(source: Playbook, name: string): Playbook {
  const stamp = new Date().toISOString()
  const formationIds = new Map<string, string>()
  const formations = source.formations.map((formation) => {
    const id = createId()
    formationIds.set(formation.id, id)
    return {
      ...formation,
      id,
      players: formation.players.map((player) => ({
        ...player,
        id: createId(),
        pos: { ...player.pos },
        route: null,
      })),
    }
  })
  const categoryIds = new Map<string, string>()
  const categories = source.categories.map((category) => {
    const id = createId()
    categoryIds.set(category.id, id)
    return { ...category, id }
  })

  return {
    ...source,
    id: createId(),
    name,
    formations,
    categories,
    routes: source.routes.map((route) => ({
      ...route,
      id: createId(),
      points: route.points.map((point) => ({ ...point })),
    })),
    plays: source.plays.map((play) => ({
      ...play,
      id: createId(),
      formationId: formationIds.get(play.formationId) ?? formations[0].id,
      categories: play.categories
        .map((categoryId) => categoryIds.get(categoryId))
        .filter((id): id is string => Boolean(id)),
      players: play.players.map((player) => ({
        ...player,
        id: createId(),
        pos: { ...player.pos },
        route: player.route
          ? { id: createId(), points: player.route.points.map((point) => ({ ...point })) }
          : null,
      })),
      createdAt: stamp,
      updatedAt: stamp,
    })),
  }
}
