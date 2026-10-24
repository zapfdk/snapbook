import type { Category, Play, Playbook, Player, RoutePoint } from '../../types'
import { BoostTextArchive } from './boostWriter'
import { segmentControl } from '../geometry'

export const PBC_VERSION = '0.22.0'
const BOOST_LIBRARY_VERSION = 19
/** std::numeric_limits<double>::min(), PBC's "no bezier control point" value. */
const DUMMY = 2.2250738585072014e-308

export class PbcExportError extends Error {}

interface ExPath {
  endpoint: { x: number; y: number }
  control: { x: number; y: number } | null
}

interface ExRoute {
  paths: ExPath[]
}

interface ExPlayer {
  role: string
  label: string
  color: string
  pos: { x: number; y: number }
  route: ExRoute | null
  number: number
}

interface ExFormation {
  name: string
  players: ExPlayer[]
}

interface ExPlay {
  play: Play
  name: string
  codeName: string
  formation: ExFormation
  categories: ExCategory[]
  comment: string
}

interface ExCategory {
  name: string
  plays: ExPlay[]
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const parseColor = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return [0, 0, 0]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const shortLabel = (player: Player): string => {
  const raw = (player.label || player.role || 'P')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  if (raw === 'SLOT') return 'SLT'
  return raw.slice(0, 3) || 'P'
}

const toPbcRelative = (player: Player, absolute: { x: number; y: number }) => {
  const x = clamp(absolute.x, -12.4, 12.4)
  const y = clamp(absolute.y, -7.4, 17.4)
  return {
    x: (x - player.pos.x) * (player.pos.x < 0 ? 1 : -1),
    y: y - player.pos.y,
  }
}

const routeToPbc = (player: Player, points: RoutePoint[]): ExRoute | null => {
  if (!points.length) return null
  const paths: ExPath[] = []
  let previous = { ...player.pos }
  for (const point of points) {
    const absolute = { x: player.pos.x + point.x, y: player.pos.y + point.y }
    const control = segmentControl(previous, absolute, point.curve)
    paths.push({
      endpoint: toPbcRelative(player, absolute),
      control: control
        ? {
            x: (clamp(control.x, -12.4, 12.4) - player.pos.x) *
              (player.pos.x < 0 ? 1 : -1),
            y: clamp(control.y, -7.4, 17.4) - player.pos.y,
          }
        : null,
    })
    previous = absolute
  }
  return { paths }
}

const toExPlayer = (player: Player, withRoute: boolean): ExPlayer => ({
  role: player.role || player.label,
  label: shortLabel(player),
  color: player.color,
  pos: {
    x: clamp(player.pos.x, -12, 12),
    y: clamp(player.pos.y, -7, 17),
  },
  route: withRoute && player.route ? routeToPbc(player, player.route.points) : null,
  number: player.number && player.number > 0 ? Math.min(99, Math.round(player.number)) : 0,
})

const ensureUnique = (label: string, names: string[]) => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) duplicates.add(name)
    seen.add(key)
  }
  if (duplicates.size) {
    throw new PbcExportError(
      `${label} names must be unique for Playbook Creator: ${[...duplicates].join(', ')}`,
    )
  }
}

export function buildPbcArchive(playbook: Playbook): string {
  const formations = playbook.formations.map((formation) => ({
    id: formation.id,
    name: formation.name.trim() || 'Formation',
    players: formation.players.map((player) => toExPlayer(player, false)),
  }))
  ensureUnique('Formation', formations.map((formation) => formation.name))

  const categories: ExCategory[] = playbook.categories.map((category: Category) => ({
    name: category.name.trim() || 'Category',
    plays: [],
  }))
  ensureUnique('Category', categories.map((category) => category.name))

  const plays: ExPlay[] = playbook.plays.map((play) => {
    const formation = formations.find((item) => item.id === play.formationId)
    return {
      play,
      name: play.name.trim() || 'Untitled play',
      codeName: play.codeName.trim(),
      formation: {
        name: formation?.name ?? 'Custom',
        players: play.players.map((player) => toExPlayer(player, true)),
      },
      categories: play.categories
        .map((id) => {
          const index = playbook.categories.findIndex((category) => category.id === id)
          return categories[index]
        })
        .filter((category): category is ExCategory => Boolean(category)),
      comment: play.notes.trim(),
    }
  })
  ensureUnique('Play', plays.map((play) => play.name))

  for (const category of categories) {
    category.plays = plays
      .filter((play) => play.categories.includes(category))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  for (const play of plays) {
    play.categories.sort((a, b) => a.name.localeCompare(b.name))
  }

  const archive = new BoostTextArchive()
  archive.str('serialization::archive')
  archive.num(BOOST_LIBRARY_VERSION)

  archive.object('PBCPlaybook', 1, () => {
    archive.str(PBC_VERSION)
    archive.str(playbook.name.trim() || 'Snapbook playbook')
    archive.num(5)
    archive.map(
      'map<string,shared_ptr<PBCFormation>>',
      'pair<const string,shared_ptr<PBCFormation>>',
      [...formations]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((formation) => [formation.name, formation] as [string, ExFormation]),
      (formation) =>
        archive.sharedPtr('shared_ptr<PBCFormation>', 'PBCFormation', 0, formation, (value) => {
          archive.object(
            'PBCCategory',
            0,
            () => {
              archive.str(value.name)
              archive.object('set<shared_ptr<PBCPlay>>', 0, () => {
                archive.num(0)
                archive.num(1)
              })
            },
            { identity: {} },
          )
          archive.sharedPtrCollection(
            'vector<shared_ptr<PBCPlayer>>',
            'shared_ptr<PBCPlayer>',
            'PBCPlayer',
            3,
            value.players,
            writePlayer,
          )
        }),
    )

    archive.map('map<string,shared_ptr<PBCRoute>>', 'pair<const string,shared_ptr<PBCRoute>>', [], () =>
      undefined,
    )

    archive.map(
      'map<string,shared_ptr<PBCPlay>>',
      'pair<const string,shared_ptr<PBCPlay>>',
      [...plays]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((play) => [play.name, play] as [string, ExPlay]),
      (play) => archive.sharedPtr('shared_ptr<PBCPlay>', 'PBCPlay', 1, play, writePlay),
    )

    archive.map(
      'map<string,shared_ptr<PBCCategory>>',
      'pair<const string,shared_ptr<PBCCategory>>',
      [...categories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((category) => [category.name, category] as [string, ExCategory]),
      (category) =>
        archive.sharedPtr('shared_ptr<PBCCategory>', 'PBCCategory', 0, category, (value) => {
          archive.str(value.name)
          archive.sharedPtrCollection(
            'set<shared_ptr<PBCPlay>>',
            'shared_ptr<PBCPlay>',
            'PBCPlay',
            1,
            value.plays,
            writePlay,
          )
        }),
    )
  })

  return archive.toString()

  function writePlayer(player: ExPlayer) {
    archive.str(player.role)
    archive.charArray4('array<char,4>', player.label)
    archive.object('PBCColor', 0, () => {
      const [red, green, blue] = parseColor(player.color)
      archive.num(red)
      archive.num(green)
      archive.num(blue)
    })
    archive.float(player.pos.x)
    archive.float(player.pos.y)
    archive.sharedPtr('shared_ptr<PBCRoute>', 'PBCRoute', 0, player.route, writeRoute)
    archive.sharedPtr('shared_ptr<PBCMotion>', 'PBCMotion', 0, null, () => undefined)
    archive.str('')
    archive.num(player.number)
    archive.object('vector<shared_ptr<PBCRoute>>', 0, () => {
      archive.num(0)
      archive.num(1)
    })
    archive.nullPtr('shared_ptr<PBCRoute>')
    archive.nullPtr('shared_ptr<PBCRoute>')
  }

  function writeRoute(route: ExRoute) {
    archive.object('PBCAbstractMovement', 0, () => {
      archive.object('vector<shared_ptr<PBCPath>>', 0, () => {
        archive.num(route.paths.length)
        archive.num(1)
        for (const path of route.paths) {
          archive.sharedPtr('shared_ptr<PBCPath>', 'PBCPath', 2, path, writePath)
        }
      })
    })
    archive.str('')
    archive.str('')
  }

  function writePath(path: ExPath) {
    archive.float(path.endpoint.x)
    archive.float(path.endpoint.y)
    archive.float(path.control?.x ?? DUMMY)
    archive.float(path.control?.y ?? DUMMY)
  }

  function writePlay(play: ExPlay) {
    archive.str(play.name)
    archive.str(play.codeName)
    archive.sharedPtr(
      'shared_ptr<PBCFormation>',
      'PBCFormation',
      0,
      play.formation,
      (formation) => {
        archive.object(
          'PBCCategory',
          0,
          () => {
            archive.str(formation.name)
            archive.object('set<shared_ptr<PBCPlay>>', 0, () => {
              archive.num(0)
              archive.num(1)
            })
          },
          { identity: {} },
        )
        archive.sharedPtrCollection(
          'vector<shared_ptr<PBCPlayer>>',
          'shared_ptr<PBCPlayer>',
          'PBCPlayer',
          3,
          formation.players,
          writePlayer,
        )
      },
    )
    archive.sharedPtrCollection(
      'set<shared_ptr<PBCCategory>>',
      'shared_ptr<PBCCategory>',
      'PBCCategory',
      0,
      play.categories,
      (category) => {
        archive.str(category.name)
        archive.sharedPtrCollection(
          'set<shared_ptr<PBCPlay>>',
          'shared_ptr<PBCPlay>',
          'PBCPlay',
          1,
          category.plays,
          writePlay,
        )
      },
    )
    archive.str(play.comment)
  }
}

const PASSWORD_SALT_BYTES = 16
const IV_BYTES = 12
const PBKDF2_ITERATIONS = 10000

export async function createPbcFile(playbook: Playbook, password: string): Promise<Uint8Array> {
  const archive = buildPbcArchive(playbook)
  const archiveBytes = new TextEncoder().encode(archive)
  const header = new TextEncoder().encode(
    `Playbook-Creator\n${PBC_VERSION}\nplaybook\n`,
  )
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, archiveBytes),
  )

  const file = new Uint8Array(header.length + salt.length + iv.length + ciphertext.length)
  file.set(header, 0)
  file.set(salt, header.length)
  file.set(iv, header.length + salt.length)
  file.set(ciphertext, header.length + salt.length + iv.length)
  return file
}

export function pbcFileName(playbookName: string): string {
  const slug = playbookName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'snapbook'}-playbook.pbc`
}

export function downloadPbcFile(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
