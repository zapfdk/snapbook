import {
  type Category,
  type Formation,
  type Play,
  type Playbook,
  type Player,
  type Point,
  createId,
} from '../types'
import { ROUTE_PRESETS, type RoutePreset } from './routePresets'
import { DEFAULT_ROUTE_LIBRARY, cloneRouteLibrary } from './routeLibrary'

export { ROUTE_PRESETS }
export type { RoutePreset }

export const PALETTE = {
  center: '#F1EEE4',
  quarterback: '#F4C95D',
  receiver1: '#FF8265',
  receiver2: '#64D8C4',
  back: '#B09CFF',
  slot: '#82B7FF',
  ink: '#10150F',
}

/** Shared swatches used by the designer and team setup. */
export const PLAYER_COLORS = [
  '#F1EEE4',
  '#F4C95D',
  '#FF8265',
  '#64D8C4',
  '#B09CFF',
  '#82B7FF',
  '#F08EC0',
  '#B8D96B',
]

const PLAYER_TEMPLATES: Array<{
  role: string
  label: string
  color: string
  pos: Point
}> = [
  { role: 'Center', label: 'C', color: PALETTE.center, pos: { x: 0, y: 0 } },
  { role: 'Quarterback', label: 'QB', color: PALETTE.quarterback, pos: { x: 0, y: -4.5 } },
  {
    role: 'Wide Receiver Left',
    label: 'WR-L',
    color: PALETTE.receiver1,
    pos: { x: -11, y: 0 },
  },
  {
    role: 'Wide Receiver Right',
    label: 'WR-R',
    color: PALETTE.receiver2,
    pos: { x: 11, y: 0 },
  },
  {
    role: 'Halfback',
    label: 'HB',
    color: PALETTE.back,
    pos: { x: 4, y: -2 },
  },
]

const makePlayer = (
  template: (typeof PLAYER_TEMPLATES)[number],
  overrides: Partial<Player> = {},
): Player => ({
  id: createId(),
  role: template.role,
  label: template.label,
  number: null,
  color: template.color,
  pos: { ...template.pos },
  route: null,
  ...overrides,
})

const makeFormation = (
  name: string,
  build: (template: (typeof PLAYER_TEMPLATES)[number], index: number) => Player,
): Formation => ({
  id: createId(),
  name,
  players: PLAYER_TEMPLATES.map(build),
})

const formations: Formation[] = [
  makeFormation('Spread Right', (t) => makePlayer(t)),
  makeFormation('Spread Left', (t) => {
    if (t.label === 'WR-L') {
      return makePlayer(t, { role: 'Wide Receiver Right', label: 'WR-R', color: PALETTE.receiver2, pos: { x: 11, y: 0 } })
    }
    if (t.label === 'WR-R') {
      return makePlayer(t, { role: 'Wide Receiver Left', label: 'WR-L', color: PALETTE.receiver1, pos: { x: -11, y: 0 } })
    }
    if (t.label === 'HB') return makePlayer(t, { pos: { x: -4, y: -2 } })
    return makePlayer(t)
  }),
  makeFormation('Trips Right', (t) => {
    if (t.label === 'HB') {
      return makePlayer(
        { role: 'Slot Receiver', label: 'SLOT', color: PALETTE.slot, pos: { x: 6, y: -1 } },
        { number: null },
      )
    }
    return makePlayer(t)
  }),
  makeFormation('Trips Left', (t) => {
    if (t.label === 'WR-L') {
      return makePlayer(t, { role: 'Wide Receiver Right', label: 'WR-R', color: PALETTE.receiver2, pos: { x: 11, y: 0 } })
    }
    if (t.label === 'WR-R') {
      return makePlayer(t, { role: 'Wide Receiver Left', label: 'WR-L', color: PALETTE.receiver1, pos: { x: -11, y: 0 } })
    }
    if (t.label === 'HB') {
      return makePlayer({ role: 'Slot Receiver', label: 'SLOT', color: PALETTE.slot, pos: { x: -6, y: -1 } })
    }
    return makePlayer(t)
  }),
  makeFormation('Bunch Right', (t) => {
    if (t.label === 'WR-R') return makePlayer(t, { pos: { x: 8, y: 0 } })
    if (t.label === 'HB') {
      return makePlayer({ role: 'Slot Receiver', label: 'SLOT', color: PALETTE.slot, pos: { x: 10.5, y: -1.5 } })
    }
    return makePlayer(t)
  }),
  makeFormation('Empty Right', (t) => {
    if (t.label === 'HB') {
      return makePlayer({ role: 'Slot Receiver', label: 'SLOT', color: PALETTE.slot, pos: { x: 6, y: 0 } })
    }
    return makePlayer(t)
  }),
]

const categories: Category[] = [
  { id: createId(), name: 'Quick game', color: '#F4C95D' },
  { id: createId(), name: 'Dropback', color: '#82B7FF' },
  { id: createId(), name: 'Screens', color: '#64D8C4' },
  { id: createId(), name: 'Red zone', color: '#FF8265' },
]

const team = {
  center: formations[0].players[0],
  qb: formations[0].players[1],
  wrl: formations[0].players[2],
  wrr: formations[0].players[3],
  hb: formations[0].players[4],
}

function routeFromPreset(presetId: string, player: Player, id = createId()) {
  const preset = ROUTE_PRESETS.find((p) => p.id === presetId)
  if (!preset) return null
  const sideSign = player.pos.x > 0 ? -1 : 1
  return {
    id,
    points: preset.points.map((p) => ({
      x: Number((p.x * sideSign).toFixed(2)),
      y: p.y,
      ...(p.curve ? { curve: p.curve } : {}),
    })),
  }
}

function clonePlayers(formation: Formation): Player[] {
  return formation.players.map((p) => ({
    ...p,
    id: createId(),
    pos: { ...p.pos },
    route: null,
  }))
}

function makePlay(opts: {
  name: string
  codeName: string
  formation: Formation
  categoryNames: string[]
  notes?: string
  routes: Record<string, string | null>
}): Play {
  const players = clonePlayers(opts.formation)
  for (const player of players) {
    const preset = opts.routes[player.label]
    if (preset) player.route = routeFromPreset(preset, player)
  }
  return {
    id: createId(),
    name: opts.name,
    codeName: opts.codeName,
    formationId: opts.formation.id,
    players,
    categories: opts.categoryNames.map(
      (name) => categories.find((c) => c.name === name)?.id ?? categories[0].id,
    ),
    notes: opts.notes ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const DEFAULT_PLAYBOOK: Playbook = {
  id: createId(),
  name: 'My flag playbook',
  team: '',
  level: '5v5',
  formations,
  categories,
  routes: cloneRouteLibrary(DEFAULT_ROUTE_LIBRARY),
  plays: [
    makePlay({
      name: 'Mesh Right',
      codeName: 'MESH',
      formation: formations[2],
      categoryNames: ['Dropback'],
      notes: 'Clear the middle with the corner, mesh underneath.',
      routes: { 'WR-L': 'drag', 'WR-R': 'mesh', SLOT: 'corner' },
    }),
    makePlay({
      name: 'Four Verticals',
      codeName: 'V4',
      formation: formations[0],
      categoryNames: ['Dropback'],
      notes: 'Read the safety. Throw away from rotation.',
      routes: { 'WR-L': 'go', 'WR-R': 'go', HB: 'seam' },
    }),
    makePlay({
      name: 'Smash',
      codeName: 'SMASH',
      formation: formations[0],
      categoryNames: ['Quick game'],
      notes: 'Corner over the curl vs off coverage.',
      routes: { 'WR-L': 'corner', 'WR-R': 'curl' },
    }),
    makePlay({
      name: 'Slant Flat',
      codeName: 'SF',
      formation: formations[0],
      categoryNames: ['Quick game', 'Red zone'],
      notes: 'Take the free access throw if the flat defender widens.',
      routes: { 'WR-L': 'slant', 'WR-R': 'flat' },
    }),
    makePlay({
      name: 'Flood Right',
      codeName: 'FLOOD',
      formation: formations[2],
      categoryNames: ['Dropback'],
      routes: { 'WR-R': 'go', SLOT: 'out', 'WR-L': 'slant' },
    }),
    makePlay({
      name: 'Drive Left',
      codeName: 'DRIVE',
      formation: formations[1],
      categoryNames: ['Dropback'],
      routes: { 'WR-R': 'dig', 'WR-L': 'curl', HB: 'flat' },
    }),
    makePlay({
      name: 'Bunch Cross',
      codeName: 'BX',
      formation: formations[4],
      categoryNames: ['Quick game'],
      routes: { 'WR-R': 'mesh', SLOT: 'wheel', 'WR-L': 'slant' },
    }),
    makePlay({
      name: 'Empty Wheel',
      codeName: 'WHEEL',
      formation: formations[5],
      categoryNames: ['Red zone'],
      routes: { 'WR-R': 'fade', SLOT: 'flat', 'WR-L': 'wheel' },
    }),
    makePlay({
      name: 'Texas Sit',
      codeName: 'TEX',
      formation: formations[0],
      categoryNames: ['Quick game'],
      routes: { HB: 'texas', 'WR-L': 'hitch', 'WR-R': 'out' },
    }),
  ],
}

export function createBlankPlaybook(name: string, teamName: string): Playbook {
  return {
    id: createId(),
    name: name.trim() || 'My flag playbook',
    team: teamName.trim(),
    level: '5v5',
    formations: formations.map((formation) => ({
      ...formation,
      id: createId(),
      players: formation.players.map((player) => ({
        ...player,
        id: createId(),
        pos: { ...player.pos },
        route: null,
      })),
    })),
    categories: categories.map((category) => ({ ...category, id: createId() })),
    routes: cloneRouteLibrary(DEFAULT_ROUTE_LIBRARY),
    plays: [],
  }
}

/** A fresh five-player lineup for a new formation when none exists yet. */
export function createFormationPlayers(): Player[] {
  return PLAYER_TEMPLATES.map((template) => makePlayer(template))
}

// team template references are intentionally exported for the formation editor
export const BASE_TEMPLATES = { ...team }
