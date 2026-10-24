import { jsPDF } from 'jspdf'
import type { RouteTreeSettings } from '../../types'
import { computeRouteTreeLayout, TREE_FIELD_BACK, TREE_FIELD_DEPTH } from '../routeTree'
import { slugify } from '../files'

const MM_TO_PT = 72 / 25.4

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return [22, 29, 23]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function createRouteTreePdf(
  settings: RouteTreeSettings,
  playbookName: string,
  team: string,
) {
  const layout = computeRouteTreeLayout(settings, playbookName, team)
  const doc = new jsPDF({
    orientation: layout.pageWidth >= layout.pageHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [layout.pageWidth, layout.pageHeight],
    compress: true,
  })

  doc.setProperties({
    title: `${layout.header.title} — route tree`,
    subject: 'Flag football route tree',
    creator: 'Snapbook',
  })

  const ink = hexToRgb(layout.ink)
  const soft = hexToRgb(layout.inkSoft)
  const paper = hexToRgb(layout.paper)
  const fieldFill = hexToRgb(layout.fieldFill)

  doc.setFillColor(...paper)
  doc.rect(0, 0, layout.pageWidth, layout.pageHeight, 'F')

  doc.setFillColor(...fieldFill)
  doc.setDrawColor(...hexToRgb(layout.line))
  doc.setLineWidth(0.3)
  doc.rect(layout.field.x, layout.field.y, layout.field.width, layout.field.height, 'FD')

  if (settings.showFieldLines) {
    const mapY = (yards: number) =>
      layout.field.y +
      ((TREE_FIELD_DEPTH - (yards - TREE_FIELD_BACK)) / TREE_FIELD_DEPTH) * layout.field.height
    doc.setDrawColor(...hexToRgb('#ECE8DB'))
    doc.setLineWidth(0.12)
    for (let yards = TREE_FIELD_BACK; yards <= TREE_FIELD_BACK + TREE_FIELD_DEPTH; yards += 1) {
      const y = mapY(yards)
      doc.line(layout.field.x, y, layout.field.x + 0.65, y)
      doc.line(layout.field.x + layout.field.width - 0.65, y, layout.field.x + layout.field.width, y)
    }
    doc.setLineWidth(0.16)
    for (const yards of [5, 10, 15]) {
      const y = mapY(yards)
      doc.line(layout.field.x, y, layout.field.x + layout.field.width, y)
    }
    doc.setDrawColor(...hexToRgb('#C7C2B1'))
    doc.setLineWidth(0.22)
    doc.setLineDashPattern([0.9, 0.65], 0)
    const losY = mapY(0)
    doc.line(layout.field.x, losY, layout.field.x + layout.field.width, losY)
    doc.setLineDashPattern([], 0)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(...soft)
    doc.text('LOS', layout.field.x + 1.6, losY - 1.1)
    doc.setFontSize(5)
    for (const yards of [5, 10, 15]) {
      const y = mapY(yards)
      doc.text(String(yards), layout.field.x + layout.field.width - 1.5, y - 1.1, {
        align: 'right',
      })
    }
  }

  const lineWidth = Math.min(0.9, Math.max(0.55, layout.field.width * 0.0046))
  const haloWidth = lineWidth + Math.max(0.5, layout.field.width * 0.0045)
  const connectorWidth = Math.max(0.5, lineWidth * 0.9)
  doc.setLineCap('round')
  doc.setLineJoin('round')

  for (const route of layout.routes) {
    const dash = route.dash ?? []
    doc.setLineDashPattern(dash, 0)

    doc.setDrawColor(...fieldFill)
    doc.setLineWidth(haloWidth)
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1]
      const to = route.points[index]
      doc.line(from.x, from.y, to.x, to.y)
    }
    doc.line(route.end.x, route.end.y, route.badge.x, route.badge.y)

    doc.setDrawColor(...hexToRgb(route.color))
    doc.setLineWidth(lineWidth)
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1]
      const to = route.points[index]
      doc.line(from.x, from.y, to.x, to.y)
    }
    doc.setLineWidth(connectorWidth)
    doc.line(route.end.x, route.end.y, route.badge.x, route.badge.y)
  }

  doc.setLineDashPattern([], 0)
  doc.setLineWidth(lineWidth)

  for (const route of layout.routes) {
    doc.setFillColor(...paper)
    doc.circle(route.badge.x, route.badge.y, route.badgeRadius + 0.55, 'F')
    doc.setFillColor(...hexToRgb(route.color))
    doc.circle(route.badge.x, route.badge.y, route.badgeRadius, 'F')
    doc.setTextColor(...hexToRgb(route.badgeInk))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(route.numberSize * MM_TO_PT)
    doc.text(route.number, route.badge.x, route.badge.y + 0.02, {
      align: 'center',
      baseline: 'middle',
    })
  }

  doc.setFillColor(...ink)
  doc.circle(layout.origin.x, layout.origin.y, layout.origin.radius, 'F')
  doc.setDrawColor(...paper)
  doc.setLineWidth(0.55)
  doc.circle(layout.origin.x, layout.origin.y, layout.origin.radius - 0.2, 'S')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.origin.labelSize * MM_TO_PT)
  doc.text('WR', layout.origin.x, layout.origin.y + 0.05, {
    align: 'center',
    baseline: 'middle',
  })

  if (layout.legend) {
    const legend = layout.legend
    doc.setTextColor(...ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(legend.titleSize * MM_TO_PT)
    doc.text('ROUTE INDEX', legend.x, legend.titleY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...soft)
    doc.setFontSize(legend.countSize * MM_TO_PT)
    doc.text('1–9 + 0', legend.countX, legend.countY, { align: 'right' })
    doc.setDrawColor(...hexToRgb(layout.line))
    doc.setLineWidth(0.2)
    const headerRuleY = legend.titleY + legend.titleSize * 0.85
    doc.line(legend.x, headerRuleY, legend.x + legend.width, headerRuleY)

    for (const entry of legend.entries) {
      doc.setFillColor(...hexToRgb(entry.color))
      doc.circle(entry.chipX, entry.chipY, entry.chipRadius, 'F')
      doc.setTextColor(...hexToRgb(entry.badgeInk))
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(entry.chipRadius * 0.95 * MM_TO_PT)
      doc.text(entry.number, entry.chipX, entry.chipY + 0.02, {
        align: 'center',
        baseline: 'middle',
      })
      doc.setTextColor(...ink)
      doc.setFontSize(entry.nameSize * MM_TO_PT)
      doc.text(entry.name, entry.nameX, entry.nameY, { baseline: 'middle' })
      doc.setTextColor(...soft)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(entry.groupSize * MM_TO_PT)
      doc.text(entry.group.toUpperCase(), entry.groupX, entry.groupY, { baseline: 'middle' })
    }
  }

  doc.setDrawColor(...hexToRgb(layout.line))
  doc.setLineWidth(0.25)
  doc.line(layout.margin, layout.footer.ruleY, layout.pageWidth - layout.margin, layout.footer.ruleY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.footer.size * MM_TO_PT)
  doc.setTextColor(...soft)
  doc.text(layout.footer.left, layout.margin, layout.footer.y)
  doc.text(layout.footer.right, layout.pageWidth - layout.margin, layout.footer.y, {
    align: 'right',
  })

  doc.setTextColor(...ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.header.eyebrowSize * MM_TO_PT)
  doc.setTextColor(...soft)
  doc.text(layout.header.eyebrow, layout.margin, layout.header.eyebrowY)

  doc.setTextColor(...ink)
  doc.setFontSize(layout.header.titleSize * MM_TO_PT)
  doc.text(layout.header.title, layout.margin, layout.header.titleY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.header.subtitleSize * MM_TO_PT)
  doc.setTextColor(...soft)
  doc.text(layout.header.subtitle, layout.margin, layout.header.subtitleY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.header.metaSize * MM_TO_PT)
  doc.setTextColor(...ink)
  doc.text(layout.header.meta, layout.pageWidth - layout.margin, layout.header.metaY, {
    align: 'right',
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.header.metaSize * 0.64 * MM_TO_PT)
  doc.setTextColor(...soft)
  doc.text(
    layout.header.metaDetail,
    layout.pageWidth - layout.margin,
    layout.header.metaDetailY,
    { align: 'right' },
  )

  doc.setDrawColor(...hexToRgb(layout.line))
  doc.setLineWidth(0.3)
  doc.line(layout.margin, layout.header.ruleY, layout.pageWidth - layout.margin, layout.header.ruleY)

  return doc
}

export function exportRouteTreePdf(
  settings: RouteTreeSettings,
  playbookName: string,
  team: string,
) {
  const doc = createRouteTreePdf(settings, playbookName, team)
  doc.save(`${slugify(playbookName)}-route-tree.pdf`)
}
