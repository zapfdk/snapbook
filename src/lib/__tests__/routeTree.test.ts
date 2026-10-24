import { describe, expect, it } from 'vitest'
import { createRouteTreePdf } from '../pdf/routeTree'
import {
  DEFAULT_ROUTE_TREE_SETTINGS,
  TREE_FIELD_DEPTH,
  TREE_FIELD_WIDTH,
  computeRouteTreeLayout,
} from '../routeTree'

const landscape = computeRouteTreeLayout(DEFAULT_ROUTE_TREE_SETTINGS, 'My flag playbook', '')
const portrait = computeRouteTreeLayout(
  { ...DEFAULT_ROUTE_TREE_SETTINGS, pageWidth: 215.9, pageHeight: 279.4 },
  'My flag playbook',
  'Ravens',
)

describe('route tree', () => {
  it('lays out all ten numbered routes inside the field', () => {
    expect(landscape.routes.map((route) => route.number)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
    ])
    expect(landscape.routes).toHaveLength(10)
    expect(landscape.field.width / landscape.field.height).toBeCloseTo(
      TREE_FIELD_WIDTH / TREE_FIELD_DEPTH,
      4,
    )

    for (const route of landscape.routes) {
      expect(route.badge.x).toBeGreaterThan(landscape.field.x)
      expect(route.badge.x).toBeLessThan(landscape.field.x + landscape.field.width)
      expect(route.badge.y).toBeGreaterThan(landscape.field.y)
      expect(route.badge.y).toBeLessThan(landscape.field.y + landscape.field.height)
    }
  })

  it('places the legend below the field in portrait', () => {
    expect(landscape.legend?.entries).toHaveLength(10)
    expect(portrait.legend).not.toBeNull()
    expect(portrait.legend!.y).toBeGreaterThan(portrait.field.y + portrait.field.height - 0.01)
    expect(portrait.legend!.entries[0].y).toBeCloseTo(portrait.legend!.entries[5].y, 3)
    expect(portrait.legend!.entries[0].x).toBeLessThan(portrait.legend!.entries[5].x)
  })

  it('centres the field when the legend is off', () => {
    const withoutLegend = computeRouteTreeLayout(
      { ...DEFAULT_ROUTE_TREE_SETTINGS, showLegend: false },
      'My flag playbook',
      '',
    )
    expect(withoutLegend.legend).toBeNull()
    expect(withoutLegend.field.x).toBeCloseTo(
      (withoutLegend.pageWidth - withoutLegend.field.width) / 2,
      4,
    )
  })

  it('gives every route a distinct color and contrast-aware badge ink', () => {
    expect(new Set(landscape.routes.map((route) => route.color)).size).toBe(10)
    expect(landscape.routes.every((route) => route.dash === null)).toBe(true)
    expect(
      landscape.routes.every((route) =>
        ['#10150f', '#f7faf4'].includes(route.badgeInk),
      ),
    ).toBe(true)
  })

  it('uses ink and three line patterns for monochrome routes', () => {
    const mono = computeRouteTreeLayout(
      { ...DEFAULT_ROUTE_TREE_SETTINGS, monochrome: true },
      'My flag playbook',
      '',
    )
    expect(new Set(mono.routes.map((route) => route.color))).toEqual(
      new Set([mono.ink]),
    )
    expect(new Set(mono.routes.map((route) => route.dash?.join(',') ?? 'solid')).size).toBe(3)
    expect(mono.routes.every((route) => route.badgeInk === '#f7faf4')).toBe(true)
  })

  it('exports one correctly sized PDF page', () => {
    const letter = createRouteTreePdf(DEFAULT_ROUTE_TREE_SETTINGS, 'My flag playbook', '')
    expect(letter.getNumberOfPages()).toBe(1)
    expect(letter.internal.pageSize.getWidth()).toBeCloseTo(279.4, 1)
    expect(letter.internal.pageSize.getHeight()).toBeCloseTo(215.9, 1)

    const portraitDoc = createRouteTreePdf(
      { ...DEFAULT_ROUTE_TREE_SETTINGS, pageWidth: 210, pageHeight: 297 },
      'My flag playbook',
      'Ravens',
    )
    expect(portraitDoc.internal.pageSize.getWidth()).toBeCloseTo(210, 1)
    expect(portraitDoc.internal.pageSize.getHeight()).toBeCloseTo(297, 1)
    expect((portraitDoc.output('arraybuffer') as ArrayBuffer).byteLength).toBeGreaterThan(2000)
  })
})
