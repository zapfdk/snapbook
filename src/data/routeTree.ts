export interface RouteTreeRoute {
  /** Number printed in the route tree (1–9, plus 0 for the wheel). */
  number: string
  name: string
  /** Preset id from the designer's route library. */
  presetId: string
  group: 'Quick game' | 'Intermediate' | 'Deep'
  color: string
}

export const ROUTE_TREE: RouteTreeRoute[] = [
  { number: '1', name: 'Hitch', presetId: 'hitch', group: 'Quick game', color: '#C81D25' },
  { number: '2', name: 'Slant', presetId: 'slant', group: 'Quick game', color: '#E07A1F' },
  { number: '3', name: 'Out', presetId: 'out', group: 'Quick game', color: '#1B998B' },
  { number: '4', name: 'Curl', presetId: 'curl', group: 'Intermediate', color: '#1D4ED8' },
  {
    number: '5',
    name: 'Comeback',
    presetId: 'comeback',
    group: 'Intermediate',
    color: '#6D28D9',
  },
  { number: '6', name: 'Dig', presetId: 'dig', group: 'Intermediate', color: '#C2185B' },
  { number: '7', name: 'Post', presetId: 'post', group: 'Deep', color: '#2D6A4F' },
  { number: '8', name: 'Corner', presetId: 'corner', group: 'Deep', color: '#8D5B4C' },
  { number: '9', name: 'Go', presetId: 'go', group: 'Deep', color: '#4B5563' },
  { number: '0', name: 'Wheel', presetId: 'wheel', group: 'Deep', color: '#0E7490' },
]

export const ROUTE_TREE_TITLE = '5v5 Route Tree'
