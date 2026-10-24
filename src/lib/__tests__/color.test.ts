import { describe, expect, it } from 'vitest'
import { hexToRgb, readableInk } from '../color'

describe('marker colors', () => {
  it('parses short and long hex colors', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
    expect(hexToRgb('#FF8265')).toEqual([255, 130, 101])
  })

  it('falls back to the default marker color for invalid values', () => {
    expect(hexToRgb('not-a-color')).toEqual([241, 238, 228])
  })

  it('uses light ink on dark markers and dark ink on light markers', () => {
    expect(readableInk('#10150f')).toBe('#f7faf4')
    expect(readableInk('#F1EEE4')).toBe('#10150f')
    expect(readableInk('#FF8265')).toBe('#10150f')
    expect(readableInk('#E07A1F')).toBe('#10150f')
    expect(readableInk('#1B998B')).toBe('#10150f')
  })
})
