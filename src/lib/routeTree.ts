import { ROUTE_PRESETS } from '../data/defaults'
import { ROUTE_TREE, ROUTE_TREE_TITLE } from '../data/routeTree'
import type { Point, RoutePoint, RouteTreeSettings } from '../types'
import { readableInk } from './color'
import { segmentControl } from './geometry'

/** The route tree uses a 25-yard-wide field, cropped to 4 yards behind the LOS and 18 deep. */
export const TREE_FIELD_WIDTH = 25
export const TREE_FIELD_BACK = -4
export const TREE_FIELD_DEPTH = 22
export const TREE_LOS = 0

export const ROUTE_TREE_PAGE_PRESETS = [
  { id: 'letter-landscape', label: 'US Letter · landscape', width: 279.4, height: 215.9 },
  { id: 'a4-landscape', label: 'A4 · landscape', width: 297, height: 210 },
  { id: 'a3-landscape', label: 'A3 · landscape poster', width: 420, height: 297 },
  { id: 'letter-portrait', label: 'US Letter · portrait', width: 215.9, height: 279.4 },
  { id: 'a4-portrait', label: 'A4 · portrait', width: 210, height: 297 },
] as const

export const DEFAULT_ROUTE_TREE_SETTINGS: RouteTreeSettings = {
  title: ROUTE_TREE_TITLE,
  pageWidth: 279.4,
  pageHeight: 215.9,
  showFieldLines: true,
  showLegend: true,
  monochrome: false,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export interface TreePageRoute {
  number: string
  name: string
  group: string
  color: string
  /** Ink for the numbered badge, chosen for contrast against the route color. */
  badgeInk: string
  /** Dash pattern used by monochrome printing to separate route groups. */
  dash: number[] | null
  /** Sampled polyline in page millimetres. */
  points: Point[]
  end: Point
  badge: Point
  badgeRadius: number
  numberSize: number
}

export interface TreeLegendEntry {
  number: string
  name: string
  group: string
  color: string
  badgeInk: string
  x: number
  y: number
  width: number
  height: number
  chipX: number
  chipY: number
  chipRadius: number
  nameX: number
  nameY: number
  groupX: number
  groupY: number
  nameSize: number
  groupSize: number
}

export interface TreePageLayout {
  pageWidth: number
  pageHeight: number
  margin: number
  ink: string
  inkSoft: string
  paper: string
  fieldFill: string
  line: string
  showFieldLines: boolean
  field: {
    x: number
    y: number
    width: number
    height: number
  }
  header: {
    eyebrow: string
    eyebrowY: number
    eyebrowSize: number
    title: string
    titleY: number
    titleSize: number
    subtitle: string
    subtitleY: number
    subtitleSize: number
    meta: string
    metaY: number
    metaSize: number
    metaDetail: string
    metaDetailY: number
    ruleY: number
  }
  routes: TreePageRoute[]
  legend: {
    x: number
    y: number
    width: number
    height: number
    titleY: number
    titleSize: number
    countX: number
    countY: number
    countSize: number
    entries: TreeLegendEntry[]
  } | null
  footer: {
    left: string
    right: string
    y: number
    size: number
    ruleY: number
  }
  origin: {
    x: number
    y: number
    radius: number
    labelSize: number
  }
}

interface SampledRoute {
  points: Point[]
  tangent: Point
}

function sampleRoute(points: RoutePoint[]): SampledRoute {
  const sampled: Point[] = [{ x: 0, y: 0 }]
  let previous: Point = { x: 0, y: 0 }
  let tangent: Point = { x: 0, y: 1 }

  for (const point of points) {
    const target: Point = { x: point.x, y: point.y }
    const control = segmentControl(previous, target, point.curve)
    if (control) {
      const steps = 18
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps
        const inv = 1 - t
        sampled.push({
          x: inv * inv * previous.x + 2 * inv * t * control.x + t * t * target.x,
          y: inv * inv * previous.y + 2 * inv * t * control.y + t * t * target.y,
        })
      }
      tangent = { x: target.x - control.x, y: target.y - control.y }
    } else {
      sampled.push(target)
      tangent = { x: target.x - previous.x, y: target.y - previous.y }
    }
    previous = target
  }

  return { points: sampled, tangent }
}

function getPresetPoints(presetId: string): RoutePoint[] {
  return ROUTE_PRESETS.find((preset) => preset.id === presetId)?.points ?? []
}

/** In monochrome, line pattern keeps quick, intermediate and deep routes apart. */
function routeDash(group: string, monochrome: boolean): number[] | null {
  if (!monochrome) return null
  if (group === 'Intermediate') return [2.6, 1.4]
  if (group === 'Deep') return [0.7, 1.3]
  return null
}

export function computeRouteTreeLayout(
  settings: RouteTreeSettings,
  playbookName: string,
  team: string,
): TreePageLayout {
  const pageWidth = Math.max(60, settings.pageWidth)
  const pageHeight = Math.max(60, settings.pageHeight)
  const leaf = Math.min(pageWidth, pageHeight)
  const margin = clamp(leaf * 0.05, 8.5, 16)
  const landscape = pageWidth >= pageHeight
  const ink = '#161D17'
  const inkSoft = '#6F786D'
  const paper = '#FFFFFF'
  const fieldFill = '#FFFDF5'
  const line = '#DAD6C6'

  const eyebrowSize = clamp(leaf * 0.013, 1.9, 2.7)
  const titleSize = clamp(leaf * 0.043, 6.4, 10.5)
  const subtitleSize = clamp(leaf * 0.0145, 2.2, 3.1)
  const metaSize = clamp(leaf * 0.016, 2.3, 3.3)
  const metaDetailSize = clamp(leaf * 0.0105, 1.7, 2.3)
  const eyebrowY = margin + eyebrowSize
  const titleY = eyebrowY + titleSize * 1.08
  const subtitleY = titleY + subtitleSize * 2.1
  const ruleY = subtitleY + subtitleSize * 2.6
  const contentTop = ruleY + clamp(leaf * 0.032, 5.5, 9)
  const footerSize = clamp(leaf * 0.0095, 1.55, 2.15)
  const footerRuleY = pageHeight - margin - footerSize * 2.4
  const footerY = pageHeight - margin
  const contentBottom = footerRuleY - clamp(leaf * 0.018, 3.2, 5.5)

  const footerLeft = `${playbookName.trim() || 'Snapbook'} · SNAPBOOK`
  const footerRight = 'PRINT AT 100% · NO SCALING'
  const headerTitle = (settings.title.trim() || ROUTE_TREE_TITLE).toUpperCase()
  const subtitle = team.trim()
    ? `${team.trim()} · numbered passing routes`
    : 'Numbered passing routes for 5v5 flag football'
  const meta = `${ROUTE_TREE.length} ROUTES`
  const metaDetail = '1–9 + 0 WHEEL'

  let fieldX = margin
  let fieldY = contentTop
  let fieldWidth = 0
  let fieldHeight = 0
  let legend: TreePageLayout['legend'] = null

  if (landscape) {
    const legendWidth = settings.showLegend ? clamp(pageWidth * 0.26, 62, 84) : 0
    const gap = settings.showLegend ? clamp(pageWidth * 0.028, 6, 10) : 0
    const availableWidth = pageWidth - margin * 2 - legendWidth - gap
    const availableHeight = contentBottom - contentTop
    fieldWidth = Math.min(availableWidth, availableHeight / (TREE_FIELD_DEPTH / TREE_FIELD_WIDTH))
    fieldHeight = fieldWidth * (TREE_FIELD_DEPTH / TREE_FIELD_WIDTH)
    fieldX = margin + (availableWidth - fieldWidth) / 2
    fieldY = contentTop + (availableHeight - fieldHeight) / 2
    if (settings.showLegend) {
      legend = {
        x: pageWidth - margin - legendWidth,
        y: fieldY,
        width: legendWidth,
        height: fieldHeight,
        titleY: 0,
        titleSize: 0,
        countX: 0,
        countY: 0,
        countSize: 0,
        entries: [],
      }
    }
  } else {
    const legendHeight = settings.showLegend ? clamp(pageHeight * 0.185, 42, 58) : 0
    const gap = settings.showLegend ? clamp(pageHeight * 0.022, 5, 8) : 0
    const availableWidth = pageWidth - margin * 2
    const availableHeight = contentBottom - contentTop - legendHeight - gap
    fieldWidth = Math.min(availableWidth, availableHeight / (TREE_FIELD_DEPTH / TREE_FIELD_WIDTH))
    fieldHeight = fieldWidth * (TREE_FIELD_DEPTH / TREE_FIELD_WIDTH)
    fieldX = (pageWidth - fieldWidth) / 2
    fieldY = contentTop + (availableHeight - fieldHeight) / 2
    if (settings.showLegend) {
      legend = {
        x: margin,
        y: fieldY + fieldHeight + gap,
        width: availableWidth,
        height: legendHeight,
        titleY: 0,
        titleSize: 0,
        countX: 0,
        countY: 0,
        countSize: 0,
        entries: [],
      }
    }
  }

  const scaleX = fieldWidth / TREE_FIELD_WIDTH
  const scaleY = fieldHeight / TREE_FIELD_DEPTH
  const toPage = (point: Point): Point => ({
    x: fieldX + (point.x + TREE_FIELD_WIDTH / 2) * scaleX,
    y: fieldY + (TREE_FIELD_DEPTH - (point.y - TREE_FIELD_BACK)) * scaleY,
  })

  const origin = toPage({ x: 0, y: TREE_LOS })
  const badgeRadius = clamp(fieldWidth * 0.019, 2.15, 3.6)
  const numberSize = badgeRadius * 0.95

  const routes: TreePageRoute[] = ROUTE_TREE.map((route) => {
    const sampled = sampleRoute(getPresetPoints(route.presetId))
    const points = sampled.points.map(toPage)
    const end = points[points.length - 1]
    const tangent = {
      x: sampled.tangent.x * scaleX,
      y: -sampled.tangent.y * scaleY,
    }
    const length = Math.hypot(tangent.x, tangent.y) || 1
    const unit = { x: tangent.x / length, y: tangent.y / length }
    const offset = badgeRadius + clamp(fieldWidth * 0.007, 0.8, 1.6)
    const clampedBadge = {
      x: clamp(end.x + unit.x * offset, fieldX + badgeRadius + 0.4, fieldX + fieldWidth - badgeRadius - 0.4),
      y: clamp(end.y + unit.y * offset, fieldY + badgeRadius + 0.4, fieldY + fieldHeight - badgeRadius - 0.4),
    }
    const color = settings.monochrome ? ink : route.color
    return {
      number: route.number,
      name: route.name,
      group: route.group,
      color,
      badgeInk: readableInk(color),
      dash: routeDash(route.group, settings.monochrome),
      points,
      end,
      badge: clampedBadge,
      badgeRadius,
      numberSize,
    }
  })

  if (legend) {
    const titleSize = clamp(leaf * 0.0115, 1.8, 2.5)
    legend.titleY = legend.y + titleSize + 1.5
    legend.titleSize = titleSize
    legend.countSize = clamp(leaf * 0.0105, 1.6, 2.2)
    legend.countX = legend.x + legend.width
    legend.countY = legend.titleY
    const headerHeight = titleSize + 5.2
    const columns = landscape ? 1 : 2
    const rows = 10
    const rowsPerColumn = Math.ceil(rows / columns)
    const rowHeight = (legend.height - headerHeight) / rowsPerColumn
    const columnWidth = legend.width / columns
    const chipRadius = clamp(Math.min(rowHeight * 0.26, columnWidth * 0.075), 2.1, 3.3)
    const nameSize = clamp(rowHeight * 0.29, 2.25, 3.35)
    const groupSize = clamp(nameSize * 0.68, 1.55, 2.05)

    legend.entries = ROUTE_TREE.map((route, index) => {
      const column = Math.floor(index / rowsPerColumn)
      const row = index % rowsPerColumn
      const x = legend.x + column * columnWidth
      const y = legend.y + headerHeight + row * rowHeight
      const chipX = x + chipRadius + 0.6
      const chipY = y + rowHeight / 2
      const nameX = chipX + chipRadius + clamp(columnWidth * 0.035, 1.8, 3)
      return {
        number: route.number,
        name: route.name,
        group: route.group,
        color: settings.monochrome ? ink : route.color,
        badgeInk: readableInk(settings.monochrome ? ink : route.color),
        x,
        y,
        width: columnWidth,
        height: rowHeight,
        chipX,
        chipY,
        chipRadius,
        nameX,
        nameY: chipY - nameSize * 0.08,
        groupX: nameX,
        groupY: chipY + groupSize * 1.28,
        nameSize,
        groupSize,
      }
    })
  }

  return {
    pageWidth,
    pageHeight,
    margin,
    ink,
    inkSoft,
    paper,
    fieldFill,
    line,
    showFieldLines: settings.showFieldLines,
    field: { x: fieldX, y: fieldY, width: fieldWidth, height: fieldHeight },
    header: {
      eyebrow: 'SNAPBOOK / 5V5 FLAG FOOTBALL',
      eyebrowY,
      eyebrowSize,
      title: headerTitle,
      titleY,
      titleSize,
      subtitle,
      subtitleY,
      subtitleSize,
      meta,
      metaY: titleY,
      metaSize,
      metaDetail,
      metaDetailY: titleY + metaDetailSize * 1.65,
      ruleY,
    },
    routes,
    legend,
    footer: {
      left: footerLeft,
      right: footerRight,
      y: footerY,
      size: footerSize,
      ruleY: footerRuleY,
    },
    origin: {
      x: origin.x,
      y: origin.y,
      radius: clamp(fieldWidth * 0.024, 2.8, 4.2),
      labelSize: clamp(fieldWidth * 0.016, 1.85, 2.8),
    },
  }
}
