/**
 * Reads a Playbook Creator `.pbc` file: the AES-256-GCM container that
 * `exportPbc` writes, and the Boost.Serialization text archive inside it.
 *
 * The archive grammar is mirrored from `boostWriter.ts`, which is checked
 * token by token against native Boost.Serialization, so this reader and that
 * writer agree on class table, tracking flags, object ids, versions and the
 * order of every field. Everything it meets is validated and anything
 * unexpected is reported instead of guessed at.
 */

import { routeGroupColor } from '../../data/routeLibrary'
import {
  clampPlayerPoint,
  clampRoutePointForPlayer,
  curveFromOffset,
  offsetPoint,
  segmentOffset,
  withCurve,
} from '../geometry'
import {
  createId,
  type Category,
  type Formation,
  type LibraryRoute,
  type Play,
  type Player,
  type Playbook,
  type Point,
  type Route,
  type RouteGroup,
  type RoutePoint,
} from '../../types'

export class PbcImportError extends Error {}

const CONTAINER_MAGIC = 'Playbook-Creator'
const CONTAINER_KIND = 'playbook'
const BOOST_SIGNATURE = 'serialization::archive'
const PASSWORD_SALT_BYTES = 16
const IV_BYTES = 12
const PBKDF2_ITERATIONS = 10000
const GCM_TAG_BYTES = 16
const BOOST_LIBRARY_VERSION = 19
/** std::numeric_limits<double>::min(): PBC's "this segment has no bow" value. */
const NO_CONTROL = 1e-300
const DEFAULT_CATEGORY_COLOR = '#F4C95D'
const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0b, 0x0c, 0x0d])

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const round = (value: number): number => Math.round(value * 100) / 100

/**
 * The class table of a Boost text archive. Class ids are counted in the order
 * the archive first writes each class, both by the writer and here, so the ids
 * in a file are only checked for consistency: a file that reuses one id for two
 * classes is not the archive layout this reader understands.
 */
class ClassTable {
  private entries = new Map<string, { id: number; version: number; ready: boolean }>()
  private ids = new Map<number, string>()

  register(type: string, version: number) {
    let entry = this.entries.get(type)
    if (!entry) {
      entry = { id: this.entries.size, version, ready: false }
      this.entries.set(type, entry)
    }
    return entry
  }

  claim(id: number, type: string) {
    const known = this.ids.get(id)
    if (known && known !== type) {
      throw new PbcImportError(
        `This file gives class ${id} two different meanings (${known} and ${type}); it is not a Playbook Creator 0.22 archive Snapbook can read.`,
      )
    }
    this.ids.set(id, type)
  }

  /** Compares the version recorded in the file with the one this reader knows. */
  checkVersion(type: string, version: number, fileVersion: number) {
    if (fileVersion !== version) {
      throw new PbcImportError(
        `This file stores ${type} as version ${fileVersion}; Snapbook reads version ${version}. It may come from a different Playbook Creator release.`,
      )
    }
  }
}

/**
 * A cursor over the decrypted archive. Boost's text format separates tokens
 * with whitespace and prefixes every string with its byte length, so the reader
 * works on bytes: a string is exactly as many bytes as its length says, whatever
 * the characters in it.
 */
class BoostTextReader {
  private index = 0
  private classes = new ClassTable()
  /** Object ids whose payload has already been read, so a back reference is skipped. */
  private written = new Set<number>()

  constructor(private readonly bytes: Uint8Array) {}

  get position() {
    return this.index
  }

  private skipSpace() {
    while (this.index < this.bytes.length && WHITESPACE.has(this.bytes[this.index])) {
      this.index += 1
    }
  }

  atEnd(): boolean {
    this.skipSpace()
    return this.index >= this.bytes.length
  }

  private token(what: string): string {
    this.skipSpace()
    const start = this.index
    while (this.index < this.bytes.length && !WHITESPACE.has(this.bytes[this.index])) {
      this.index += 1
    }
    if (this.index === start) {
      throw new PbcImportError(`The ${what} is missing; the file ends earlier than its structure says.`)
    }
    return decoder.decode(this.bytes.subarray(start, this.index))
  }

  int(what: string): number {
    const text = this.token(what)
    const value = Number(text)
    if (!Number.isSafeInteger(value)) {
      throw new PbcImportError(`The ${what} is “${text}” instead of a whole number.`)
    }
    return value
  }

  float(what: string): number {
    const text = this.token(what)
    const value = Number(text)
    if (!Number.isFinite(value)) {
      throw new PbcImportError(`The ${what} is “${text}” instead of a number.`)
    }
    return value
  }

  count(what: string, limit = 100_000): number {
    const value = this.int(what)
    if (value < 0 || value > limit) {
      throw new PbcImportError(`The ${what} in this file is ${value}, which cannot be right.`)
    }
    return value
  }

  str(what: string): string {
    const length = this.count(`${what} length`, 1_000_000)
    this.skipSpace()
    const end = this.index + length
    if (end > this.bytes.length) {
      throw new PbcImportError(`The ${what} runs past the end of the file.`)
    }
    const value = decoder.decode(this.bytes.subarray(this.index, end))
    this.index = end
    return value
  }

  /**
   * A class written by value (map, pair, vector, colour, array). The archive
   * records its tracking flag and version the first time it writes the class
   * and nothing after that. A class that Boost tracks also carries an object id
   * every time.
   */
  value(type: string, version: number, tracked = false): void {
    const entry = this.classes.register(type, version)
    if (!entry.ready) {
      const flag = this.int(`${type} tracking flag`)
      this.classes.checkVersion(type, version, this.int(`${type} version`))
      if (flag !== (tracked ? 1 : 0)) {
        throw new PbcImportError(`This file stores ${type} in a shape Snapbook does not know.`)
      }
      entry.ready = true
    }
    if (tracked) this.int(`${type} object id`)
  }

  /**
   * A `boost::shared_ptr<T>`. Returns null for a null pointer, otherwise the
   * target's object id and whether its payload follows: Boost writes the
   * payload once and only refers back to the id afterwards.
   */
  pointer(
    type: string,
    version: number,
    wrapper: string,
  ): { id: number; isNew: boolean } | null {
    this.value(wrapper, 1)
    const classId = this.int(`${type} class id`)
    if (classId === -1) return null
    const entry = this.classes.register(type, version)
    if (!entry.ready) {
      this.classes.claim(classId, type)
      const flag = this.int(`${type} tracking flag`)
      this.classes.checkVersion(type, version, this.int(`${type} version`))
      if (flag !== 1) {
        throw new PbcImportError(`This file stores ${type} in a shape Snapbook does not know.`)
      }
      entry.ready = true
    } else {
      this.classes.claim(classId, type)
    }
    const id = this.int(`${type} object id`)
    const isNew = !this.written.has(id)
    this.written.add(id)
    return { id, isNew }
  }

  /** `std::array<char, 4>` as Playbook Creator stores a marker label. */
  charArray(what: string, size: number): string {
    this.value(`array<char,${size}>`, 0)
    const count = this.count(`${what} length`, 4096)
    const chars: string[] = []
    for (let index = 0; index < count; index += 1) {
      const code = this.int(`${what} character`)
      if (index < size && code > 0 && code <= 0x10ffff) chars.push(String.fromCodePoint(code))
    }
    return chars.join('')
  }
}

interface PbcPath {
  endpoint: Point
  control: Point | null
}

/**
 * What a movement adds on top of its shared paths: a route keeps a name and a
 * wrist code, a motion keeps the position its player ends up at.
 */
type MovementKind = 'route' | 'motion'

interface PbcMovement {
  paths: PbcPath[]
  /** A route's own name and wrist code; a motion carries neither. */
  name: string
  code: string
}

interface PbcPlayerRecord {
  role: string
  label: string
  color: string
  pos: Point
  number: number | null
  route: PbcMovement | null
  motion: PbcMovement | null
}

interface PbcFormationRecord {
  name: string
  players: PbcPlayerRecord[]
}

interface PbcPlayRecord {
  name: string
  codeName: string
  formation: PbcFormationRecord
  categoryIds: string[]
  notes: string
}

interface PbcArchive {
  version: string
  name: string
  fieldSize: number
  formations: PbcFormationRecord[]
  /** The playbook's own routes, under the names Playbook Creator keys them by. */
  routes: PbcMovement[]
  plays: PbcPlayRecord[]
  categories: Category[]
}

/**
 * Reads the archive into a Playbook. Playbook Creator keys formations, plays
 * and categories by name, so those names are unique in the file; Snapbook keeps
 * the same rule, and a name that somehow repeats is given a suffix.
 */
export function parsePbcArchive(input: string | Uint8Array): Playbook {
  const reader = new BoostTextReader(
    typeof input === 'string' ? encoder.encode(input) : input,
  )
  const signature = reader.str('archive signature')
  if (signature !== BOOST_SIGNATURE) {
    throw new PbcImportError('That file does not hold a Boost.Serialization archive.')
  }
  const libraryVersion = reader.int('archive version')
  if (libraryVersion !== BOOST_LIBRARY_VERSION) {
    throw new PbcImportError(
      `That file was written with Boost.Serialization ${libraryVersion}; Snapbook reads ${BOOST_LIBRARY_VERSION}.`,
    )
  }

  const archive = new PbcArchiveReader(reader).read()
  if (!reader.atEnd()) {
    throw new PbcImportError('That file has more data than Snapbook could read.')
  }
  return toPlaybook(archive)
}

/** Walks the archive mirroring the order `buildPbcArchive` writes it in. */
class PbcArchiveReader {
  private formations = new Map<number, PbcFormationRecord>()
  private plays = new Map<number, PbcPlayRecord>()
  private categories = new Map<number, Category>()
  private movements = new Map<number, PbcMovement>()

  constructor(private readonly reader: BoostTextReader) {}

  read(): PbcArchive {
    const reader = this.reader
    reader.value('PBCPlaybook', 1)
    const version = reader.str('Playbook Creator version')
    const name = reader.str('playbook name')
    const fieldSize = reader.int('field size')

    // The four maps are read in the order the writer emits them.
    const formations = this.readFormationMap()
    const routes = this.readRouteLibrary()
    const plays = this.readPlayMap()
    const categories = this.readCategoryMap()
    return { version, name, fieldSize, formations, routes, plays, categories }
  }

  private readFormationMap(): PbcFormationRecord[] {
    const reader = this.reader
    const formations: PbcFormationRecord[] = []
    reader.value('map<string,shared_ptr<PBCFormation>>', 0)
    const count = reader.count('formation count')
    reader.int('formation pair version')
    for (let index = 0; index < count; index += 1) {
      reader.value('pair<const string,shared_ptr<PBCFormation>>', 0)
      const key = reader.str(`formation ${index + 1} name`)
      const pointer = reader.pointer(
        'PBCFormation',
        0,
        'shared_ptr<PBCFormation>',
      )
      if (!pointer) {
        throw new PbcImportError(`Formation “${key}” has no alignment.`)
      }
      const cached = this.formations.get(pointer.id)
      if (cached) {
        formations.push(cached)
        continue
      }
      const formation = this.readFormation(pointer.id)
      if (!formation.name) formation.name = key
      formations.push(formation)
    }
    return formations
  }

  /**
   * A formation is a PBCCategory base (name and the plays that use it) plus its
   * players. It is filed under its object id before its body is read, because
   * the plays that use it refer back to this same object.
   */
  private readFormation(id: number): PbcFormationRecord {
    const reader = this.reader
    const formation: PbcFormationRecord = { name: '', players: [] }
    this.formations.set(id, formation)
    reader.value('PBCCategory', 0, true)
    formation.name = reader.str('formation name')
    this.readPlaySet()
    formation.players = this.readPlayers()
    return formation
  }

  private readPlayers(): PbcPlayerRecord[] {
    const reader = this.reader
    const players: PbcPlayerRecord[] = []
    reader.value('vector<shared_ptr<PBCPlayer>>', 0)
    const count = reader.count('player count')
    reader.int('player item version')
    for (let index = 0; index < count; index += 1) {
      const pointer = reader.pointer('PBCPlayer', 3, 'shared_ptr<PBCPlayer>')
      if (!pointer) continue
      if (!pointer.isNew) continue
      players.push(this.readPlayer())
    }
    return players
  }

  private readPlayer(): PbcPlayerRecord {
    const reader = this.reader
    const role = reader.str('player position')
    const label = reader.charArray('player label', 4)
    reader.value('PBCColor', 0)
    const red = reader.int('player colour')
    const green = reader.int('player colour')
    const blue = reader.int('player colour')
    const x = reader.float('player x')
    const y = reader.float('player y')
    const route = this.readMovement('PBCRoute', 0, 'route', 'route')
    const motion = this.readMovement('PBCMotion', 0, 'pre-snap motion', 'motion')
    reader.str('player name')
    const number = reader.int('player number')
    // Playbook Creator keeps option routes and two alternative routes beside the
    // main one. Snapbook's options branch off a point of the route, which the
    // file does not record, so these are read to stay in step and then dropped.
    this.readRouteSlots()
    return {
      role,
      label,
      color: hexColor(red, green, blue),
      pos: { x: round(x), y: round(y) },
      number: number > 0 ? Math.min(99, Math.round(number)) : null,
      route,
      motion,
    }
  }

  private readRouteSlots() {
    const reader = this.reader
    reader.value('vector<shared_ptr<PBCRoute>>', 0)
    const count = reader.count('extra route count')
    reader.int('extra route item version')
    for (let index = 0; index < count; index += 1) {
      const pointer = reader.pointer('PBCRoute', 0, 'shared_ptr<PBCRoute>')
      if (!pointer) continue
      if (!pointer.isNew) continue
      this.readMovementBody('route')
    }
    for (let index = 0; index < 2; index += 1) {
      const pointer = reader.pointer('PBCRoute', 0, 'shared_ptr<PBCRoute>')
      if (!pointer) continue
      if (!pointer.isNew) continue
      this.readMovementBody('route')
    }
  }

  private readPlaySet(): string[] {
    const reader = this.reader
    const names: string[] = []
    reader.value('set<shared_ptr<PBCPlay>>', 0)
    const count = reader.count('play count')
    reader.int('play item version')
    for (let index = 0; index < count; index += 1) {
      const pointer = reader.pointer('PBCPlay', 1, 'shared_ptr<PBCPlay>')
      if (!pointer) continue
      const cached = this.plays.get(pointer.id)
      if (cached) {
        names.push(cached.name)
        continue
      }
      if (!pointer.isNew) continue
      const play = this.readPlay()
      this.plays.set(pointer.id, play)
      names.push(play.name)
    }
    return names
  }

  private readPlayMap(): PbcPlayRecord[] {
    const reader = this.reader
    const plays: PbcPlayRecord[] = []
    reader.value('map<string,shared_ptr<PBCPlay>>', 0)
    const count = reader.count('play count')
    reader.int('play pair version')
    for (let index = 0; index < count; index += 1) {
      reader.value('pair<const string,shared_ptr<PBCPlay>>', 0)
      const key = reader.str(`play ${index + 1} name`)
      const pointer = reader.pointer('PBCPlay', 1, 'shared_ptr<PBCPlay>')
      if (!pointer) {
        throw new PbcImportError(`Play “${key}” is empty.`)
      }
      const cached = this.plays.get(pointer.id)
      if (cached) {
        plays.push(cached)
        continue
      }
      if (!pointer.isNew) {
        throw new PbcImportError(`Play “${key}” refers to a play that is not in the file.`)
      }
      const play = this.readPlay()
      if (!play.name) play.name = key
      this.plays.set(pointer.id, play)
      plays.push(play)
    }
    return plays
  }

  private readPlay(): PbcPlayRecord {
    const reader = this.reader
    const name = reader.str('play name')
    const codeName = reader.str('play code')
    const formation = this.readPlayFormation()
    const categoryIds = this.readCategorySet()
    return { name, codeName, formation, categoryIds, notes: reader.str('play notes') }
  }

  private readPlayFormation(): PbcFormationRecord {
    const reader = this.reader
    const pointer = reader.pointer('PBCFormation', 0, 'shared_ptr<PBCFormation>')
    if (!pointer) {
      throw new PbcImportError('A play in this file has no alignment.')
    }
    const cached = this.formations.get(pointer.id)
    if (cached) return cached
    if (!pointer.isNew) return { name: '', players: [] }
    return this.readFormation(pointer.id)
  }

  /** The tags a play carries, read as their category objects. */
  private readCategorySet(): string[] {
    const reader = this.reader
    const ids: string[] = []
    reader.value('set<shared_ptr<PBCCategory>>', 0)
    const count = reader.count('tag count')
    reader.int('tag item version')
    for (let index = 0; index < count; index += 1) {
      const pointer = reader.pointer('PBCCategory', 0, 'shared_ptr<PBCCategory>')
      if (!pointer) continue
      const cached = this.categories.get(pointer.id)
      if (cached) {
        ids.push(cached.id)
        continue
      }
      if (!pointer.isNew) continue
      const category = this.readCategory(pointer.id)
      ids.push(category.id)
    }
    return ids
  }

  private readCategory(id: number): Category {
    const reader = this.reader
    const category: Category = { id: createId(), name: '', color: DEFAULT_CATEGORY_COLOR }
    this.categories.set(id, category)
    category.name = reader.str('tag name')
    this.readPlaySet()
    return category
  }

  private readCategoryMap(): Category[] {
    const reader = this.reader
    const categories: Category[] = []
    reader.value('map<string,shared_ptr<PBCCategory>>', 0)
    const count = reader.count('tag count')
    reader.int('tag pair version')
    for (let index = 0; index < count; index += 1) {
      reader.value('pair<const string,shared_ptr<PBCCategory>>', 0)
      const key = reader.str(`tag ${index + 1} name`)
      const pointer = reader.pointer('PBCCategory', 0, 'shared_ptr<PBCCategory>')
      if (!pointer) {
        throw new PbcImportError(`Tag “${key}” is empty.`)
      }
      const cached = this.categories.get(pointer.id)
      if (cached) {
        categories.push(cached)
        continue
      }
      if (!pointer.isNew) {
        throw new PbcImportError(`Tag “${key}” refers to a tag that is not in the file.`)
      }
      const category = this.readCategory(pointer.id)
      if (!category.name) category.name = key
      categories.push(category)
    }
    return categories
  }

  /**
   * A movement: the paths every movement shares, then whatever its own class
   * adds on top. `what` names it in an error message, and the pre-snap motion
   * slot is one a Playbook Creator file fills but our own export leaves empty,
   * so a failure says which movement it was instead of reporting a broken file.
   */
  private readMovement(
    type: string,
    version: number,
    what: string,
    kind: MovementKind,
  ): PbcMovement | null {
    const pointer = this.reader.pointer(type, version, `shared_ptr<${type}>`)
    if (!pointer) return null
    const cached = this.movements.get(pointer.id)
    if (cached) return cached
    if (!pointer.isNew) return null
    try {
      const movement = this.readMovementBody(kind)
      this.movements.set(pointer.id, movement)
      return movement
    } catch (error) {
      throw new PbcImportError(
        `Snapbook could not read the ${what} in this file${error instanceof Error ? ` (${error.message})` : ''}.`,
      )
    }
  }

  private readMovementBody(kind: MovementKind): PbcMovement {
    const reader = this.reader
    reader.value('PBCAbstractMovement', 0)
    reader.value('vector<shared_ptr<PBCPath>>', 0)
    const count = reader.count('path count')
    reader.int('path item version')
    const paths: PbcPath[] = []
    for (let index = 0; index < count; index += 1) {
      const pointer = reader.pointer('PBCPath', 2, 'shared_ptr<PBCPath>')
      if (!pointer) continue
      if (!pointer.isNew) continue
      paths.push(this.readPath())
    }
    if (kind === 'route') {
      // The name and wrist code a route carries. A play's own route repeats the
      // name of the library entry it was applied from, which is what the library
      // import below uses as its key.
      const name = reader.str('route name')
      const code = reader.str('route code')
      return { paths, name, code }
    }
    // A motion carries the position its player ends up at, which repeats the
    // last path's end — the point Snapbook measures the route from.
    reader.float('motion end x')
    reader.float('motion end y')
    return { paths, name: '', code: '' }
  }

  private readPath(): PbcPath {
    const reader = this.reader
    const endpoint = { x: reader.float('path x'), y: reader.float('path y') }
    const controlX = reader.float('path bow')
    const controlY = reader.float('path bow')
    // Playbook Creator writes std::numeric_limits<double>::min() when a segment
    // has no bow at all.
    const hasControl = Math.abs(controlX) > NO_CONTROL && Math.abs(controlY) > NO_CONTROL
    return { endpoint, control: hasControl ? { x: controlX, y: controlY } : null }
  }

  /**
   * The playbook's route library: the routes Playbook Creator offers to apply to
   * a player, kept under the names the archive keys them by. These become the
   * imported playbook's library routes.
   */
  private readRouteLibrary(): PbcMovement[] {
    const reader = this.reader
    const routes: PbcMovement[] = []
    reader.value('map<string,shared_ptr<PBCRoute>>', 0)
    const count = reader.count('route library count')
    reader.int('route library pair version')
    for (let index = 0; index < count; index += 1) {
      reader.value('pair<const string,shared_ptr<PBCRoute>>', 0)
      const key = reader.str(`route ${index + 1} name`)
      const route = this.readMovement(
        'PBCRoute',
        0,
        `route library entry “${key}”`,
        'route',
      )
      // Playbook Creator keys the map by the route's name, so the key is the
      // name unless the body disagrees about it.
      if (route) routes.push({ ...route, name: route.name || key })
    }
    return routes
  }
}

const hexColor = (red: number, green: number, blue: number): string => {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase()
}

/** Names act as keys in both apps, so a repeat gets a suffix. */
function uniqueName(base: string, fallback: string, used: Set<string>): string {
  const trimmed = base.trim() || fallback
  let candidate = trimmed
  let suffix = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${trimmed} (${suffix})`
    suffix += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * Playbook Creator stores a movement as endpoints measured from where the
 * movement starts, mirrored for the right-hand side of the formation, and bows
 * as bezier control points. Snapbook stores offsets from where the movement
 * starts too — the alignment for a motion, the end of the motion for a route,
 * which is where Playbook Creator draws the route from as well — plus a
 * perpendicular bow, so `origin` is that start point and both are converted in
 * terms of it.
 */
function movementToPoints(movement: PbcMovement, origin: Point, sign: number): RoutePoint[] {
  const points: RoutePoint[] = []
  let previous: Point = origin
  for (const path of movement.paths) {
    const endpoint = {
      x: origin.x + path.endpoint.x * sign,
      y: origin.y + path.endpoint.y,
    }
    const control = path.control
      ? { x: origin.x + path.control.x * sign, y: origin.y + path.control.y }
      : null
    // The control point sits at the full bow; the bow Snapbook stores is the
    // one a handle reaches, half of it.
    const curve = control
      ? curveFromOffset(segmentOffset(previous, endpoint, control) / 2)
      : 0
    points.push(
      clampRoutePointForPlayer(
        origin,
        withCurve(
          {
            x: round(endpoint.x - origin.x),
            y: round(endpoint.y - origin.y),
          },
          curve,
        ),
      ),
    )
    previous = endpoint
  }
  return points
}

const toRoute = (movement: PbcMovement | null, origin: Point, sign: number): Route | null => {
  if (!movement) return null
  const points = movementToPoints(movement, origin, sign)
  return points.length ? { id: createId(), points } : null
}

function toPlayer(record: PbcPlayerRecord): Player {
  const pos = clampPlayerPoint(record.pos)
  // Playbook Creator mirrors a movement for the right-hand side of the formation.
  const sign = pos.x < 0 ? 1 : -1
  const label = record.label.trim().slice(0, 4)
  const motionPoints = record.motion ? movementToPoints(record.motion, pos, sign) : []
  // A motion is measured from the alignment and a route from where the motion
  // ends, which is the same rule Snapbook draws by, so no shift is applied here.
  const origin = motionPoints.length
    ? offsetPoint(pos, motionPoints[motionPoints.length - 1])
    : pos
  const route = toRoute(record.route, origin, sign)
  return {
    id: createId(),
    role: record.role.trim() || label || 'Player',
    label: label || record.role.trim().slice(0, 4) || 'P',
    number: record.number,
    color: record.color,
    pos,
    route,
    ...(motionPoints.length ? { motion: { id: createId(), points: motionPoints } } : {}),
  }
}

/**
 * A library route is measured from the receiver, which is the field's own origin
 * — the same place Snapbook's preset routes start from.
 */
const RECEIVER_ORIGIN: Point = { x: 0, y: 0 }

/**
 * Snapbook groups its library routes by how deep they break, and .pbc has no
 * such field, so an imported route is grouped by how far downfield it ends. The
 * thresholds are picked so Playbook Creator's own default routes land where
 * Snapbook's closest presets sit.
 */
function groupForDepth(points: RoutePoint[]): RouteGroup {
  const depth = Math.max(...points.map((point) => point.y))
  if (depth >= 12.5) return 'Deep'
  if (depth >= 7) return 'Intermediate'
  return 'Quick game'
}

/**
 * The imported playbook's route library: exactly the routes Playbook Creator
 * kept in the file, under the names the file gave them. Snapbook's own presets
 * are offered when the import is confirmed, not added here.
 */
function toRouteLibrary(archive: PbcArchive): LibraryRoute[] {
  const routes: LibraryRoute[] = []
  const usedNames = new Set<string>()
  for (const record of archive.routes) {
    const points = movementToPoints(record, RECEIVER_ORIGIN, 1)
    if (!points.length) continue
    const group = groupForDepth(points)
    routes.push({
      id: createId(),
      // A route with no name of its own still needs one, and a name the file
      // already uses takes a suffix.
      name: uniqueName(record.name, 'Imported route', usedNames),
      group,
      color: routeGroupColor(group),
      // A .pbc route keeps a wrist code beside it and no other text, so the code
      // becomes the note rather than being dropped.
      note: record.code.trim(),
      points,
    })
  }
  return routes
}

function toPlaybook(archive: PbcArchive): Playbook {
  const formationNames = new Set<string>()
  const formations: Formation[] = archive.formations
    .filter((formation) => formation.players.length)
    .map((formation) => ({
      id: createId(),
      name: uniqueName(formation.name, 'Formation', formationNames),
      players: formation.players.map(toPlayer),
    }))

  const usedCategoryNames = new Set<string>()
  const categories: Category[] = archive.categories.map((category) => ({
    ...category,
    name: uniqueName(category.name, 'Tag', usedCategoryNames),
  }))
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const plays: Play[] = archive.plays.map((record) => {
    const players = record.formation.players.map(toPlayer)
    // A play's lineup is its own: it is matched to a stored formation only when
    // both the name and the player count line up, so the playbook stays valid.
    const match = formations.find(
      (formation) =>
        formation.name.toLowerCase() === record.formation.name.trim().toLowerCase() &&
        formation.players.length === players.length,
    )
    const formation =
      match ??
      (() => {
        const created: Formation = {
          id: createId(),
          name: uniqueName(
            record.formation.name || `${record.name} formation`,
            'Formation',
            formationNames,
          ),
          players: players.map((player) => ({ ...player, route: null, motion: null })),
        }
        formations.push(created)
        return created
      })()

    const now = new Date().toISOString()
    return {
      id: createId(),
      name: record.name.trim(),
      codeName: record.codeName.trim(),
      formationId: formation.id,
      players,
      categories: Array.from(
        new Set(
          record.categoryIds
            .map((id) => categoryById.get(id)?.name)
            .filter((name): name is string => Boolean(name))
            .map((name) => categories.find((category) => category.name === name)!.id),
        ),
      ),
      notes: record.notes.trim(),
      createdAt: now,
      updatedAt: now,
    }
  })

  return {
    id: createId(),
    name: archive.name.trim() || 'Playbook Creator playbook',
    team: '',
    // Playbook Creator records how many players a side fields.
    level: archive.fieldSize === 7 ? '7v7' : '5v5',
    formations,
    plays,
    categories,
    routes: toRouteLibrary(archive),
  }
}

interface PbcEncryption {
  salt: Uint8Array
  iv: Uint8Array
  payload: Uint8Array
}

/**
 * A .pbc container holds either the archive in the open — the file was saved
 * without a password — or the material that encrypts it.
 */
type PbcContainer = { version: string } & (
  | { plaintext: Uint8Array; encryption: null }
  | { plaintext: null; encryption: PbcEncryption }
)

/**
 * True when these bytes begin a Boost text archive: its signature, preceded by
 * that signature's byte length. Ciphertext is random, so it does not pass this
 * by accident.
 */
function isBoostArchiveStart(bytes: Uint8Array): boolean {
  let index = 0
  while (index < bytes.length && WHITESPACE.has(bytes[index])) index += 1
  const digitsStart = index
  while (index < bytes.length && bytes[index] >= 0x30 && bytes[index] <= 0x39) index += 1
  if (index === digitsStart) return false
  if (Number(decoder.decode(bytes.subarray(digitsStart, index))) !== BOOST_SIGNATURE.length) {
    return false
  }
  if (index >= bytes.length || !WHITESPACE.has(bytes[index])) return false
  index += 1
  return (
    decoder.decode(bytes.subarray(index, index + BOOST_SIGNATURE.length)) === BOOST_SIGNATURE
  )
}

export function readPbcContainer(bytes: Uint8Array): PbcContainer {
  let headerEnd = -1
  let newlines = 0
  for (let index = 0; index < Math.min(bytes.length, 96); index += 1) {
    if (bytes[index] !== 0x0a) continue
    newlines += 1
    if (newlines === 3) {
      headerEnd = index + 1
      break
    }
  }
  if (headerEnd === -1) {
    throw new PbcImportError(
      'That file is not a Playbook Creator .pbc file: its header is missing.',
    )
  }
  const [magic, version, kind] = decoder.decode(bytes.subarray(0, headerEnd)).split('\n')
  if (magic !== CONTAINER_MAGIC) {
    throw new PbcImportError(
      'That file is not a Playbook Creator .pbc file: its header is missing.',
    )
  }
  if (kind !== CONTAINER_KIND) {
    throw new PbcImportError(`That .pbc file holds a ${kind || 'unknown'} file, not a playbook.`)
  }
  const rest = bytes.subarray(headerEnd)
  // A file saved without a password keeps its archive in the open, with no
  // salt, IV or ciphertext around it.
  if (isBoostArchiveStart(rest)) {
    return { version: version || 'unknown', plaintext: rest, encryption: null }
  }
  if (rest.length <= PASSWORD_SALT_BYTES + IV_BYTES + GCM_TAG_BYTES) {
    throw new PbcImportError('That .pbc file is empty or truncated.')
  }
  return {
    version: version || 'unknown',
    plaintext: null,
    encryption: {
      salt: rest.subarray(0, PASSWORD_SALT_BYTES),
      iv: rest.subarray(PASSWORD_SALT_BYTES, PASSWORD_SALT_BYTES + IV_BYTES),
      payload: rest.subarray(PASSWORD_SALT_BYTES + IV_BYTES),
    },
  }
}

/**
 * Opens the container and reads the archive inside it. A file that carries no
 * password opens with an empty one: either its archive is in the open, or it
 * was encrypted with the empty string, which derives a key like any other.
 */
export async function importPbcFile(
  bytes: Uint8Array,
  password: string,
): Promise<Playbook> {
  const container = readPbcContainer(bytes)
  if (container.plaintext) return parsePbcArchive(container.plaintext)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: container.encryption.salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: container.encryption.iv, tagLength: 128 },
      key,
      container.encryption.payload,
    )
  } catch {
    // AES-GCM cannot tell a wrong password from a damaged file: both fail the
    // same authentication check, so the message names both.
    throw new PbcImportError(
      password
        ? 'That password did not open the file. Playbook Creator passwords cannot be recovered, so check the password — and that the whole file arrived in one piece.'
        : 'This file needs a password, or it did not arrive in one piece. Leave the field empty only for a file that was saved without one; Playbook Creator passwords cannot be recovered.',
    )
  }
  return parsePbcArchive(new Uint8Array(plaintext))
}
