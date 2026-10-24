import type { RoutePoint } from '../types'

export interface RoutePreset {
  id: string
  name: string
  /** x is "toward the middle" in yards, y is downfield. */
  points: RoutePoint[]
}

export const ROUTE_PRESETS: RoutePreset[] = [
  { id: 'go', name: 'Go', points: [{ x: 0.3, y: 13 }] },
  { id: 'post', name: 'Post', points: [{ x: 0, y: 6 }, { x: 4, y: 14, curve: 1.8 }] },
  { id: 'corner', name: 'Corner', points: [{ x: 0, y: 6 }, { x: -4, y: 14, curve: -1.8 }] },
  { id: 'out', name: 'Out', points: [{ x: 0, y: 8 }, { x: -6, y: 8, curve: -0.6 }] },
  { id: 'dig', name: 'Dig', points: [{ x: 0, y: 9 }, { x: 6, y: 9, curve: 0.6 }] },
  { id: 'slant', name: 'Slant', points: [{ x: 0, y: 2 }, { x: 5, y: 6 }] },
  { id: 'curl', name: 'Curl', points: [{ x: 0, y: 10 }, { x: 1.4, y: 8, curve: 0.7 }] },
  { id: 'comeback', name: 'Comeback', points: [{ x: 0, y: 12 }, { x: 1.2, y: 9.5, curve: 0.5 }] },
  { id: 'hitch', name: 'Hitch', points: [{ x: 0, y: 5 }, { x: 0.4, y: 3.6 }] },
  { id: 'flat', name: 'Flat', points: [{ x: 0, y: 1 }, { x: -5, y: 2, curve: -0.35 }] },
  { id: 'swing', name: 'Swing', points: [{ x: -0.5, y: -1 }, { x: -5, y: 0.8 }] },
  { id: 'wheel', name: 'Wheel', points: [{ x: -2, y: 2, curve: -1.2 }, { x: -2, y: 12 }] },
  { id: 'seam', name: 'Seam', points: [{ x: 0.8, y: 13 }] },
  { id: 'fade', name: 'Fade', points: [{ x: -1.4, y: 13, curve: -0.8 }] },
  { id: 'drag', name: 'Drag', points: [{ x: 0, y: 3 }, { x: 12, y: 4.2, curve: 1 }] },
  { id: 'mesh', name: 'Mesh', points: [{ x: 0, y: 2 }, { x: 8, y: 3, curve: 0.6 }] },
  { id: 'texas', name: 'Texas', points: [{ x: 0, y: 4 }, { x: 3.5, y: 6.5 }] },
  { id: 'angle', name: 'Angle', points: [{ x: 0, y: 3 }, { x: -3, y: 5.2 }] },
]
