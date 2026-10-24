const FALLBACK = '#f1eee4'

const channel = (value: number) => {
  const normalized = value / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

/** Parses #rgb or #rrggbb, falling back to the default marker color. */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((letter) => letter + letter)
          .join('')
      : clean
  if (!/^[0-9a-f]{6}$/i.test(full)) return hexToRgb(FALLBACK)
  const value = Number.parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Returns a #rrggbb value accepted by native color inputs. */
export function normalizeHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Picks the marker label ink that stays legible on a custom marker color.
 * Uses relative luminance so arbitrary colors from the color picker keep
 * readable labels in the designer, diagrams and printed wrist cards.
 */
export function readableInk(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.2 ? '#10150f' : '#f7faf4'
}
