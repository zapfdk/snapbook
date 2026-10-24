export interface Point {
  /** Yards to the right of the ball (negative = left). */
  x: number
  /** Yards downfield from the line of scrimmage (negative = behind). */
  y: number
}

export interface RoutePoint extends Point {
  /** Perpendicular bow of the segment leading into this point, in yards. */
  curve?: number
}

export interface Route {
  id: string
  /** Points are relative to the player's alignment. */
  points: RoutePoint[]
}

export interface Player {
  id: string
  /** Full position name, e.g. "Wide Receiver Left". */
  role: string
  /** Compact label shown on diagrams, max 4 chars. */
  label: string
  number: number | null
  color: string
  pos: Point
  route: Route | null
}

export interface Formation {
  id: string
  name: string
  players: Player[]
}

export type RouteGroup = 'Quick game' | 'Intermediate' | 'Deep'

/** A reusable route preset in the playbook's editable route library. */
export interface LibraryRoute {
  id: string
  name: string
  group: RouteGroup
  color: string
  note: string
  /** Relative to the receiver, with x pointing toward the middle for a left receiver. */
  points: RoutePoint[]
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface Play {
  id: string
  name: string
  codeName: string
  formationId: string
  players: Player[]
  categories: string[]
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Playbook {
  id: string
  name: string
  team: string
  level: '5v5' | '7v7'
  formations: Formation[]
  plays: Play[]
  categories: Category[]
  routes: LibraryRoute[]
}

export interface RouteTreeSettings {
  title: string
  pageWidth: number
  pageHeight: number
  showFieldLines: boolean
  showLegend: boolean
  monochrome: boolean
}

export interface WristCoachSettings {
  selectedPlayIds: string[]
  columns: number
  rows: number
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  showCodeName: boolean
  showCardNumber: boolean
  showCutLines: boolean
  showFieldLines: boolean
  showPlayerLabels: boolean
  playerLabelMode: 'label' | 'number'
  inkColor: string
  monochrome: boolean
}

export const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11)
