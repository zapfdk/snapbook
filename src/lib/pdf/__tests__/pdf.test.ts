import { describe, expect, it } from 'vitest'
import { DEFAULT_PLAYBOOK } from '../../../data/defaults'
import type { RouteTreeSettings, WristCoachSettings } from '../../../types'
import { createRouteTreePdf } from '../routeTree'
import { createWristCoachPdf } from '../wristCoach'

/**
 * The printed sheets are the app's main output and nothing else checks them, so
 * a library upgrade could break the export without a single failing test. These
 * are structural checks, not a picture: a valid header and trailer, one page
 * object per sheet, and no markup from a playbook name reaching the file.
 */

const wristSettings: WristCoachSettings = {
  selectedPlayIds: [],
  columns: 3,
  rows: 3,
  pageWidth: 150,
  pageHeight: 100,
  marginTop: 6,
  marginBottom: 6,
  marginLeft: 6,
  marginRight: 6,
  showCodeName: true,
  showCardNumber: true,
  showCutLines: true,
  showFieldLines: true,
  showPlayerLabels: true,
  playerLabelMode: 'label',
  inkColor: '#111111',
  monochrome: false,
}

const treeSettings: RouteTreeSettings = {
  title: DEFAULT_PLAYBOOK.name,
  pageWidth: 297,
  pageHeight: 210,
  showFieldLines: true,
  showLegend: true,
  monochrome: false,
}

/** Bytes as latin1: enough to read PDF syntax, the content streams are compressed. */
function pdfBytes(doc: { output: (type: 'arraybuffer') => ArrayBuffer }): string {
  return new TextDecoder('latin1').decode(new Uint8Array(doc.output('arraybuffer')))
}

function pageCount(bytes: string): number {
  return (bytes.match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe('PDF export', () => {
  it('writes a wrist coach sheet', () => {
    const doc = createWristCoachPdf(DEFAULT_PLAYBOOK.name, DEFAULT_PLAYBOOK.plays.slice(0, 6), wristSettings)
    const bytes = pdfBytes(doc)

    expect(bytes.startsWith('%PDF-')).toBe(true)
    expect(bytes.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pageCount(bytes)).toBe(1)
  })

  it('writes a route tree', () => {
    const doc = createRouteTreePdf(treeSettings, DEFAULT_PLAYBOOK.name, DEFAULT_PLAYBOOK.team)
    const bytes = pdfBytes(doc)

    expect(bytes.startsWith('%PDF-')).toBe(true)
    expect(bytes.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pageCount(bytes)).toBe(1)
  })

  it('keeps a playbook name out of the PDF structure', () => {
    // A playbook name can arrive from a share link or an imported file, so it
    // must never be able to close the XMP packet or start markup of its own.
    const hostile = 'Bad</x:xmpmeta><script>alert(1)</script>'
    const doc = createWristCoachPdf(hostile, DEFAULT_PLAYBOOK.plays.slice(0, 1), wristSettings)
    const bytes = pdfBytes(doc)

    expect(bytes).not.toContain('<script>')
    expect(bytes).not.toContain('</x:xmpmeta><script>')
    expect(pageCount(bytes)).toBe(1)
  })
})
