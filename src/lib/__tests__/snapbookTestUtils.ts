import type {
  Category,
  Formation,
  LibraryRoute,
  Play,
  Playbook,
  Player,
  RouteGroup,
  RoutePoint,
} from '../../types'
import { createId } from '../../types'
import { parseSnapbook } from '../files'

import goldenComplete from './fixtures/snapbook/golden/v3-complete.expected.json?raw'
import goldenEmptyRouteLibrary from './fixtures/snapbook/golden/v3-empty-route-library.expected.json?raw'
import completeFixture from './fixtures/snapbook/valid/v3-complete.snapbook.json?raw'
import emptyRouteLibraryFixture from './fixtures/snapbook/valid/v3-empty-route-library.snapbook.json?raw'
import minimalFixture from './fixtures/snapbook/valid/v3-minimal-no-routes.snapbook.json?raw'
import noMinimumFixture from './fixtures/snapbook/valid/v3-no-min-reader.snapbook.json?raw'
import v1Fixture from './fixtures/snapbook/valid/v1-legacy-wrapper.snapbook.json?raw'
import v2Fixture from './fixtures/snapbook/valid/v2-no-route-library.snapbook.json?raw'
import v2WithMinimumFixture from './fixtures/snapbook/valid/v2-with-min-reader.snapbook.json?raw'
import v4Fixture from './fixtures/snapbook/valid/v4-additive.snapbook.json?raw'

export type JsonObject = Record<string, unknown>

export const fixtureText = {
  'v1-legacy-wrapper': v1Fixture,
  'v2-no-route-library': v2Fixture,
  'v2-with-min-reader': v2WithMinimumFixture,
  'v3-complete': completeFixture,
  'v3-empty-route-library': emptyRouteLibraryFixture,
  'v3-minimal-no-routes': minimalFixture,
  'v3-no-min-reader': noMinimumFixture,
  'v4-additive': v4Fixture,
} as const

export type FixtureName = keyof typeof fixtureText

export const fixtureNames = Object.keys(fixtureText) as FixtureName[]

export const goldenText = {
  'v3-complete': goldenComplete,
  'v3-empty-route-library': goldenEmptyRouteLibrary,
} as const

export function fixtureFile(name: FixtureName = 'v3-complete'): JsonObject {
  return JSON.parse(fixtureText[name]) as JsonObject
}

export function fixturePlaybook(name: FixtureName = 'v3-complete'): JsonObject {
  return fixtureFile(name).playbook as JsonObject
}

export function parseFixture(name: FixtureName = 'v3-complete'): Playbook {
  return parseSnapbook(fixtureText[name])
}

export function mutateFixture(
  mutate: (file: JsonObject, playbook: JsonObject) => void,
  name: FixtureName = 'v3-complete',
): string {
  const file = fixtureFile(name)
  const playbook = file.playbook as JsonObject
  mutate(file, playbook)
  return JSON.stringify(file)
}

export const point = (x: number, y: number, curve?: number): RoutePoint => ({
  x,
  y,
  ...(curve === undefined ? {} : { curve }),
})

export function player(overrides: Partial<Player> = {}): Player {
  return {
    id: createId(),
    role: 'Wide Receiver Left',
    label: 'WR-L',
    number: null,
    color: '#FF8265',
    route: null,
    ...overrides,
    pos: { x: -11, y: 0, ...overrides.pos },
  }
}

export function formation(name: string, players: Player[]): Formation {
  return { id: createId(), name, players }
}

export function route(
  id: string,
  name: string,
  group: RouteGroup,
  color: string,
  points: RoutePoint[],
  note = '',
): LibraryRoute {
  return { id, name, group, color, note, points }
}

export function play(
  name: string,
  formationId: string,
  players: Player[],
  overrides: Partial<Play> = {},
): Play {
  const now = '2026-10-24T00:00:00.000Z'
  return {
    id: createId(),
    name,
    codeName: '',
    formationId,
    players,
    categories: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function category(name: string, color: string): Category {
  return { id: createId(), name, color }
}

export function playbook(overrides: Partial<Playbook> = {}): Playbook {
  return {
    id: createId(),
    name: 'Test playbook',
    team: 'Test team',
    level: '5v5',
    formations: [],
    categories: [],
    routes: [],
    plays: [],
    ...overrides,
  }
}

const round = (value: number) => {
  const rounded = Math.round(value * 100) / 100
  return rounded === 0 ? 0 : rounded
}

const roundedPoint = (entry: RoutePoint) => ({
  x: round(entry.x),
  y: round(entry.y),
  curve: round(entry.curve ?? 0),
})

/**
 * Projects a playbook into the semantics the exchange format promises to
 * preserve. Internal ids and createdAt are deliberately absent because they
 * are local implementation details, not part of the interchange contract.
 */
export function semantics(book: Playbook) {
  const formationNames = new Map(book.formations.map((item) => [item.id, item.name]))
  const categoryNames = new Map(book.categories.map((item) => [item.id, item.name]))

  return {
    name: book.name,
    team: book.team,
    level: book.level,
    categories: book.categories.map((item) => ({ name: item.name, color: item.color })),
    routes: book.routes.map((item) => ({
      name: item.name,
      group: item.group,
      color: item.color,
      note: item.note,
      points: item.points.map(roundedPoint),
    })),
    formations: book.formations.map((item) => ({
      name: item.name,
      players: item.players.map((entry) => ({
        label: entry.label,
        role: entry.role,
        number: entry.number,
        color: entry.color,
        x: round(entry.pos.x),
        y: round(entry.pos.y),
      })),
    })),
    plays: book.plays.map((item) => ({
      name: item.name,
      codeName: item.codeName,
      formation: formationNames.get(item.formationId),
      tags: item.categories.map((id) => categoryNames.get(id)),
      notes: item.notes,
      updatedAt: item.updatedAt,
      players: item.players.map((entry) => ({
        label: entry.label,
        role: entry.role,
        number: entry.number,
        color: entry.color,
        x: round(entry.pos.x),
        y: round(entry.pos.y),
        route: entry.route
          ? {
              points: entry.route.points.map(roundedPoint),
              options: (entry.route.options ?? []).map((option) => ({
                from: option.from,
                points: option.points.map(roundedPoint),
              })),
            }
          : null,
        motion: entry.motion?.points.length
          ? entry.motion.points.map(roundedPoint)
          : null,
      })),
    })),
  }
}

/** Small deterministic PRNG so property-style tests never flake. */
function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

const LABELS = ['C', 'QB', 'WR', 'SLOT', 'X', 'Y', 'Z', 'H'] as const
const ROLES = [
  'Center',
  'Quarterback',
  'Wide Receiver Left',
  'Wide Receiver Right',
  'Slot Receiver',
  'Halfback',
] as const
const COLORS = ['#F1EEE4', '#F4C95D', '#FF8265', '#64D8C4', '#B09CFF', '#82B7FF'] as const
const GROUPS: RouteGroup[] = ['Quick game', 'Intermediate', 'Deep']
const CURVES = [0, 0.25, 0.5, 1, 1.5, -0.5, -1] as const

/**
 * Generates a valid, deliberately varied playbook for round-trip tests.
 * Values are generated on quarter-yard boundaries so the writer's documented
 * two-decimal rounding cannot create differences by itself.
 */
export function randomPlaybook(seed: number): Playbook {
  const random = mulberry32(seed)
  const int = (max: number) => Math.floor(random() * max)
  const chance = (probability: number) => random() < probability
  const pick = <T>(values: readonly T[]): T => values[int(values.length)]
  const coordinate = (min: number, max: number) =>
    Math.round((min + random() * (max - min)) * 4) / 4

  let sequence = 0
  const id = (prefix: string) => `${prefix}-${seed}-${++sequence}`
  const points = (minimum: number) =>
    Array.from({ length: minimum + int(4) }, () => ({
      x: coordinate(-20, 20),
      y: coordinate(-5, 25),
      ...(chance(0.55) ? { curve: pick(CURVES) } : {}),
    }))

  const categories: Category[] = Array.from({ length: int(5) }, (_, index) => ({
    id: id('tag'),
    name: `Tag ${index + 1}`,
    color: pick(COLORS),
  }))

  const routes: LibraryRoute[] = Array.from({ length: int(5) }, (_, index) => ({
    id: id('route'),
    name: `Route ${index + 1}`,
    group: pick(GROUPS),
    color: pick(COLORS),
    note: chance(0.5) ? `Coaching note ${index + 1}.` : '',
    points: points(1),
  }))

  const formations: Formation[] = Array.from(
    { length: 1 + int(3) },
    (_, formationIndex) => ({
      id: id('formation'),
      name: `Formation ${formationIndex + 1}`,
      players: Array.from({ length: 1 + int(5) }, () => ({
        id: id('formation-player'),
        role: pick(ROLES),
        label: pick(LABELS),
        number: chance(0.7) ? 1 + int(99) : null,
        color: pick(COLORS),
        pos: { x: coordinate(-20, 20), y: coordinate(-5, 10) },
        route: null,
      })),
    }),
  )

  const plays: Play[] = Array.from({ length: int(6) }, (_, playIndex) => {
    const base = pick(formations)
    const players = base.players.map((entry) => ({
      ...entry,
      id: id('play-player'),
      pos: { ...entry.pos },
      route: null as Player['route'],
    }))

    for (const entry of players) {
      if (chance(0.65)) {
        const routePoints = points(1)
        entry.route = {
          id: id('player-route'),
          points: routePoints,
          ...(chance(0.4)
            ? {
                options: Array.from({ length: 1 + int(2) }, () => ({
                  id: id('route-option'),
                  from: int(routePoints.length),
                  points: points(1),
                })),
              }
            : {}),
        }
      }
      if (chance(0.35)) entry.motion = { id: id('player-motion'), points: points(1) }
      if (chance(0.45)) entry.label = pick(LABELS)
      if (chance(0.25)) entry.role = pick(ROLES)
      if (chance(0.2)) entry.number = chance(0.5) ? null : 1 + int(99)
      if (chance(0.2)) entry.color = pick(COLORS)
      if (chance(0.2)) entry.pos = { x: coordinate(-20, 20), y: coordinate(-5, 10) }
    }

    const tags = categories.filter(() => chance(0.45)).map((entry) => entry.id)
    const updatedAt = new Date(
      Date.UTC(2026, 0, 1 + int(300), int(24), int(60), int(60), int(1000)),
    ).toISOString()

    return {
      id: id('play'),
      name: `Play ${playIndex + 1}`,
      codeName: chance(0.7) ? `P${playIndex + 1}` : '',
      formationId: base.id,
      players,
      categories: tags,
      notes: chance(0.45) ? `Read the leverage on play ${playIndex + 1}.` : '',
      createdAt: updatedAt,
      updatedAt,
    }
  })

  return {
    id: id('book'),
    name: `Random playbook ${seed}`,
    team: chance(0.7) ? `Team ${seed}` : '',
    level: chance(0.8) ? '5v5' : '7v7',
    categories,
    routes,
    formations,
    plays,
  }
}
