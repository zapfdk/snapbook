import { jsPDF } from 'jspdf'
import type { Play, Player, Point, RoutePoint, WristCoachSettings } from '../../types'
import { hexToRgb, readableInk } from '../color'
import {
  fieldRoutePoints,
  offsetPoint,
  routeOrigin,
  segmentControl,
} from '../geometry'
import { slugify } from '../files'

export interface WristPage {
  plays: Play[]
  index: number
}

export function buildWristPages(plays: Play[], settings: WristCoachSettings): WristPage[] {
  const perPage = Math.max(1, settings.columns * settings.rows)
  const pages: WristPage[] = []
  for (let index = 0; index < plays.length; index += perPage) {
    pages.push({ plays: plays.slice(index, index + perPage), index: pages.length })
  }
  return pages
}

const MM_TO_PT = 72 / 25.4
const FIELD = 25
const LOS = 17.5

interface FieldMap {
  x: number
  y: number
  width: number
  height: number
  /** The shorter side: markers, arrowheads and stroke weights follow it. */
  size: number
  px: (x: number) => number
  py: (y: number) => number
}

function sampleRoute(
  origin: Point,
  points: RoutePoint[],
  start: Point,
): { route: Point[]; end: Point; tangent: Point } | null {
  if (!points.length) return null
  const route: Point[] = [{ ...start }]
  let previous: Point = { ...start }
  let end: Point = { ...start }
  let tangent: Point = { x: 0, y: 1 }

  for (const point of points) {
    const absolute = offsetPoint(origin, point)
    const control = segmentControl(previous, absolute, point.curve)
    if (control) {
      const steps = 16
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps
        const inv = 1 - t
        route.push({
          x: inv * inv * previous.x + 2 * inv * t * control.x + t * t * absolute.x,
          y: inv * inv * previous.y + 2 * inv * t * control.y + t * t * absolute.y,
        })
      }
      tangent = { x: absolute.x - control.x, y: absolute.y - control.y }
    } else {
      route.push(absolute)
      tangent = { x: absolute.x - previous.x, y: absolute.y - previous.y }
    }
    previous = absolute
    end = absolute
  }

  return { route, end, tangent }
}

function drawFieldLines(doc: jsPDF, map: FieldMap, fieldLines: boolean) {
  if (!fieldLines) return
  doc.setDrawColor(214, 212, 200)
  doc.setLineWidth(0.08)
  for (const yards of [15, 10, 5, -5]) {
    const y = map.py(yards)
    doc.line(map.x, y, map.x + map.width, y)
  }
  doc.setDrawColor(150, 148, 138)
  doc.setLineWidth(0.12)
  doc.setLineDashPattern([0.55, 0.4], 0)
  doc.line(map.x, map.py(0), map.x + map.width, map.py(0))
  doc.setLineDashPattern([], 0)
  doc.setDrawColor(224, 222, 210)
  doc.setLineWidth(0.08)
  doc.rect(map.x, map.y, map.width, map.height)
}

/** Dotted for an option branch, long dashes for a motion, in millimetres. */
const OPTION_DASH_MM = [0.12, 0.5]
const MOTION_DASH_MM = [0.6, 0.4]

function drawRoute(
  doc: jsPDF,
  map: FieldMap,
  points: RoutePoint[],
  color: string,
  lineWidth: number,
  origin: Point,
  dash?: number[],
  start: Point = origin,
) {
  const sampled = sampleRoute(origin, points, start)
  if (!sampled) return
  const [r, g, b] = hexToRgb(color)
  doc.setDrawColor(r, g, b)
  doc.setFillColor(r, g, b)
  doc.setLineWidth(lineWidth)
  doc.setLineCap('round')
  doc.setLineJoin('round')
  doc.setLineDashPattern(dash ?? [], 0)

  const end = { x: map.px(sampled.end.x), y: map.py(sampled.end.y) }
  const tangent = sampled.tangent
  const length = Math.hypot(tangent.x, tangent.y) || 1
  const ux = tangent.x / length
  const uy = tangent.y / length
  const size = Math.max(0.7, map.size * 0.042)

  // As on screen, the stroke stops inside the head so its round cap cannot be
  // seen around the arrow's point. In PDF space y grows downward.
  const mapped = sampled.route.map((point) => ({ x: map.px(point.x), y: map.py(point.y) }))
  const tail = mapped[mapped.length - 1]
  const before = mapped[mapped.length - 2]
  if (before) {
    const fromTail = Math.hypot(before.x - tail.x, before.y - tail.y)
    const inset = Math.min(size * 0.55, fromTail * 0.45)
    tail.x -= ux * inset
    tail.y += uy * inset
  }
  for (let index = 1; index < mapped.length; index += 1) {
    doc.line(mapped[index - 1].x, mapped[index - 1].y, mapped[index].x, mapped[index].y)
  }
  doc.setLineDashPattern([], 0)

  const base = { x: end.x - ux * size, y: end.y + uy * size }
  const spread = size * 0.5
  const left = { x: base.x - uy * spread, y: base.y - ux * spread }
  const right = { x: base.x + uy * spread, y: base.y + ux * spread }
  doc.triangle(end.x, end.y, left.x, left.y, right.x, right.y, 'F')
}

function drawPlayer(
  doc: jsPDF,
  map: FieldMap,
  player: Player,
  opts: {
    showLabels: boolean
    labelMode: 'label' | 'number'
    monochrome: boolean
    ink: [number, number, number]
    inkHex: string
  },
) {
  const x = map.px(player.pos.x)
  const y = map.py(player.pos.y)
  const radius = map.size * (opts.showLabels ? 0.031 : 0.026)
  const [r, g, b] = opts.monochrome ? opts.ink : hexToRgb(player.color)
  doc.setFillColor(r, g, b)
  doc.setDrawColor(20, 24, 19)
  doc.setLineWidth(0.1)
  if (player.label.toUpperCase() === 'C') {
    doc.rect(x - radius, y - radius, radius * 2, radius * 2, 'FD')
  } else {
    doc.circle(x, y, radius, 'FD')
  }

  if (!opts.showLabels) return
  const text =
    opts.labelMode === 'number' && player.number !== null
      ? String(player.number)
      : player.label
  // Wrist cards are tiny: keep position labels to three characters so they
  // stay legible instead of clipping the last letter.
  const letters = text.replace(/[^A-Za-z0-9]/g, '')
  const compact = letters.toUpperCase() === 'SLOT' ? 'SLT' : letters
  const maxWidth = radius * 2.05
  let rendered = compact.length > 3 ? compact.slice(0, 3) : compact
  const lengthFactor = rendered.length >= 3 ? 0.8 : rendered.length === 2 ? 0.9 : 1.05
  let fontSize = radius * MM_TO_PT * lengthFactor
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fontSize)
  const minSize = 1.55
  while (fontSize > minSize && doc.getTextWidth(rendered) > maxWidth) {
    fontSize -= 0.15
    doc.setFontSize(fontSize)
  }
  while (rendered.length > 1 && doc.getTextWidth(rendered) > maxWidth) {
    rendered = rendered.slice(0, -1)
  }
  const [tr, tg, tb] = opts.monochrome
    ? [255, 253, 244]
    : hexToRgb(readableInk(player.color))
  doc.setTextColor(tr, tg, tb)
  doc.text(rendered, x, y, { align: 'center', baseline: 'middle' })
}

function fitText(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
): { text: string; size: number } {
  let size = startSize
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.2
    doc.setFontSize(size)
  }
  let output = text
  if (doc.getTextWidth(output) > maxWidth) {
    while (output.length > 1 && doc.getTextWidth(`${output}…`) > maxWidth) {
      output = output.slice(0, -1)
    }
    output = `${output}…`
  }
  return { text: output, size }
}

function drawCard(
  doc: jsPDF,
  play: Play,
  cardNumber: number,
  cell: { x: number; y: number; width: number; height: number },
  settings: WristCoachSettings,
  ink: [number, number, number],
  inkHex: string,
) {
  const shorter = Math.min(cell.width, cell.height)
  // The field fills the whole card: a wide wrist card gets a wide field, and the
  // yard lines still give the routes their reference.
  const map: FieldMap = {
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
    size: shorter,
    px: (x) => cell.x + ((x + FIELD / 2) / FIELD) * cell.width,
    py: (y) => cell.y + ((LOS - y) / FIELD) * cell.height,
  }

  drawFieldLines(doc, map, settings.showFieldLines)
  const routeWidth = Math.max(0.16, shorter * 0.0085)
  for (const player of play.players) {
    if (!player.motion?.points.length) continue
    drawRoute(
      doc,
      map,
      fieldRoutePoints(player.pos, player.motion.points),
      settings.monochrome ? inkHex : player.color,
      Math.max(0.12, routeWidth * 0.8),
      player.pos,
      MOTION_DASH_MM,
    )
  }
  for (const player of play.players) {
    if (!player.route) continue
    const color = settings.monochrome ? inkHex : player.color
    // The route is measured from where the motion ends, so the shift and the
    // route read as one movement.
    const origin = routeOrigin(player)
    drawRoute(
      doc,
      map,
      fieldRoutePoints(origin, player.route.points),
      color,
      routeWidth,
      origin,
    )
    // An option leaves a route point and ends in its own arrow, dotted so it
    // never reads as the main break.
    const routePoints = fieldRoutePoints(origin, player.route.points)
    for (const option of player.route.options ?? []) {
      const branch = routePoints[option.from]
      if (!branch || !option.points.length) continue
      drawRoute(
        doc,
        map,
        fieldRoutePoints(origin, option.points),
        color,
        Math.max(0.12, routeWidth * 0.85),
        origin,
        OPTION_DASH_MM,
        offsetPoint(origin, branch),
      )
    }
  }
  for (const player of play.players) {
    drawPlayer(doc, map, player, {
      showLabels: settings.showPlayerLabels,
      labelMode: settings.playerLabelMode,
      monochrome: settings.monochrome,
      ink,
      inkHex,
    })
  }

  const inset = Math.min(shorter * 0.06, 2)

  if (settings.showCardNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(4.2)
    doc.setTextColor(148, 145, 132)
    doc.text(String(cardNumber).padStart(2, '0'), cell.x + inset * 0.7, cell.y + inset * 1.1)
  }

  const label =
    settings.showCodeName && play.codeName.trim() ? play.codeName.trim() : play.name
  // The name sits in the lower right corner, on a paper plate so the field's
  // lines do not run through it.
  const { text: fitted, size: fontSize } = fitText(
    doc,
    label.toUpperCase(),
    cell.width * 0.62,
    Math.min(7, Math.max(3.5, shorter * 0.22)),
    3.2,
  )
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fontSize)
  const labelRight = cell.x + cell.width - inset
  const labelBottom = cell.y + cell.height - inset
  const textWidth = doc.getTextWidth(fitted)
  const textHeight = fontSize / MM_TO_PT
  doc.setFillColor(255, 255, 255)
  doc.rect(
    labelRight - textWidth - textHeight * 0.35,
    labelBottom - textHeight * 1.1,
    textWidth + textHeight * 0.7,
    textHeight * 1.25,
    'F',
  )
  doc.setTextColor(...ink)
  doc.text(fitted, labelRight, labelBottom, { align: 'right', baseline: 'bottom' })
}

export function createWristCoachPdf(
  playbookName: string,
  plays: Play[],
  settings: WristCoachSettings,
): jsPDF {
  const { pageWidth, pageHeight, columns, rows } = settings
  // A landscape insert is a landscape PDF page, so it prints at 100% scale.
  const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait'
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageWidth, pageHeight],
    compress: true,
  })
  doc.setProperties({
    title: `${playbookName} — wrist coach`,
    subject: 'Flag football wrist coach',
    creator: 'Snapbook',
  })

  const pages = buildWristPages(plays, settings)
  const ink = hexToRgb(settings.inkColor)
  const safe = {
    top: Math.min(settings.marginTop, pageHeight * 0.35),
    bottom: Math.min(settings.marginBottom, pageHeight * 0.35),
    left: Math.min(settings.marginLeft, pageWidth * 0.35),
    right: Math.min(settings.marginRight, pageWidth * 0.35),
  }
  const areaWidth = Math.max(5, pageWidth - safe.left - safe.right)
  const areaHeight = Math.max(5, pageHeight - safe.top - safe.bottom)
  const cellWidth = areaWidth / Math.max(1, columns)
  const cellHeight = areaHeight / Math.max(1, rows)

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage([pageWidth, pageHeight], orientation)
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    page.plays.forEach((play, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      drawCard(
        doc,
        play,
        pageIndex * columns * rows + index + 1,
        {
          x: safe.left + column * cellWidth,
          y: safe.top + row * cellHeight,
          width: cellWidth,
          height: cellHeight,
        },
        settings,
        ink,
        settings.inkColor,
      )
    })
    // The cut grid belongs to the page, not to a card: every slot gets its
    // border, and it is drawn last because a card's field fills its whole cell.
    if (settings.showCutLines) {
      doc.setDrawColor(226, 224, 212)
      doc.setLineWidth(0.1)
      for (let column = 0; column <= columns; column += 1) {
        const x = safe.left + column * cellWidth
        doc.line(x, safe.top, x, safe.top + rows * cellHeight)
      }
      for (let row = 0; row <= rows; row += 1) {
        const y = safe.top + row * cellHeight
        doc.line(safe.left, y, safe.left + columns * cellWidth, y)
      }
    }
  })

  return doc
}

export function exportWristCoachPdf(
  playbookName: string,
  plays: Play[],
  settings: WristCoachSettings,
) {
  const doc = createWristCoachPdf(playbookName, plays, settings)
  doc.save(`${slugify(playbookName)}-wrist-coach.pdf`)
}
