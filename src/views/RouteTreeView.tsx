import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, FileDown, Printer } from 'lucide-react'
import { selectActivePlaybook, usePlaybook } from '../store/playbook'
import { NumberField } from '../components/NumberField'
import { RouteTreePage } from '../components/RouteTreePage'
import { exportRouteTreePdf } from '../lib/pdf/routeTree'
import { ROUTE_TREE_PAGE_PRESETS, computeRouteTreeLayout } from '../lib/routeTree'
import { cx } from '../lib/files'
import type { RouteTreeSettings } from '../types'

export function RouteTreeView() {
  const playbook = usePlaybook(selectActivePlaybook)
  const settings = usePlaybook((state) => state.routeTree)
  const updateRouteTree = usePlaybook((state) => state.updateRouteTree)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const layout = useMemo(
    () => computeRouteTreeLayout(settings, playbook.name, playbook.team),
    [settings, playbook.name, playbook.team],
  )

  const activePreset =
    ROUTE_TREE_PAGE_PRESETS.find(
      (preset) =>
        Math.abs(preset.width - settings.pageWidth) < 0.5 &&
        Math.abs(preset.height - settings.pageHeight) < 0.5,
    )?.id ?? 'custom'

  const update = (patch: Partial<RouteTreeSettings>) => updateRouteTree(patch)

  const exportPdf = () => {
    setError('')
    setExporting(true)
    window.setTimeout(() => {
      try {
        exportRouteTreePdf(settings, playbook.name, playbook.team)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PDF export failed.')
      } finally {
        setExporting(false)
      }
    }, 30)
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col xl:h-[calc(100vh-68px)] xl:flex-row">
      <main className="order-1 min-w-0 flex-1 overflow-y-auto bg-ink-950 xl:order-2">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-ink-950/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div>
            <div className="mono-label text-lime/80">Print room</div>
            <h1 className="mt-0.5 font-display text-xl font-extrabold tracking-[-0.03em] text-chalk">
              Route tree
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[0.68rem] text-slate-moss sm:block">
              10 routes · {settings.pageWidth} × {settings.pageHeight} mm
            </span>
            <button className="btn btn-primary" onClick={exportPdf} disabled={exporting}>
              <Printer size={15} />
              {exporting ? 'Building…' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-[0.76rem] text-coral">
              {error}
            </div>
          )}
          <div className="mx-auto w-full max-w-[1080px]">
            <div className="overflow-hidden rounded-lg shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
              <RouteTreePage layout={layout} ariaLabel="Numbered route tree poster preview" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.62rem] text-slate-moss">
              <span>Every route starts from the WR marker at the line of scrimmage.</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-fog">
                  <span
                    className={cx(
                      'h-1.5 w-1.5 rounded-full',
                      settings.monochrome ? 'bg-chalk' : 'bg-[#C81D25]',
                    )}
                  />
                  {settings.monochrome ? 'Monochrome line patterns' : 'Colour-coded routes'}
                </span>
                {settings.monochrome && (
                  <button
                    className="font-semibold text-lime hover:text-lime-deep"
                    onClick={() => update({ monochrome: false })}
                  >
                    Show colours
                  </button>
                )}
                <span className="font-mono uppercase tracking-[0.12em]">
                  {activePreset === 'custom'
                    ? 'Custom page'
                    : ROUTE_TREE_PAGE_PRESETS.find((preset) => preset.id === activePreset)?.label}
                </span>
              </span>
            </div>
          </div>
        </div>
      </main>

      <aside className="order-2 w-full shrink-0 overflow-y-auto border-t border-line bg-ink-900/60 p-4 xl:order-1 xl:w-[320px] xl:border-b-0 xl:border-r xl:border-t-0 xl:p-5">
        <div className="flex items-center justify-between">
          <h2 className="label">Poster setup</h2>
          <span className="font-mono text-[0.6rem] text-slate-moss">
            {settings.pageWidth > settings.pageHeight ? 'Landscape' : 'Portrait'}
          </span>
        </div>

        <label className="mt-3 grid gap-1.5">
          <span className="label">Paper size</span>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={activePreset}
              onChange={(event) => {
                const preset = ROUTE_TREE_PAGE_PRESETS.find(
                  (item) => item.id === event.target.value,
                )
                if (preset) update({ pageWidth: preset.width, pageHeight: preset.height })
              }}
            >
              {ROUTE_TREE_PAGE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom size</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-moss"
            />
          </div>
        </label>

        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="grid gap-1.5">
            <span className="label">Width mm</span>
            <NumberField
              min={60}
              max={600}
              step={0.1}
              className="input font-mono"
              value={settings.pageWidth}
              onChange={(pageWidth) => update({ pageWidth })}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Height mm</span>
            <NumberField
              min={60}
              max={600}
              step={0.1}
              className="input font-mono"
              value={settings.pageHeight}
              onChange={(pageHeight) => update({ pageHeight })}
            />
          </label>
          <button
            className="icon-btn mb-0.5 border border-line"
            onClick={() =>
              update({ pageWidth: settings.pageHeight, pageHeight: settings.pageWidth })
            }
            title="Swap orientation"
            aria-label="Swap page orientation"
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="label">Poster title</span>
          <input
            className="input"
            value={settings.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder="5v5 Route Tree"
            maxLength={48}
          />
        </label>

        <div className="mt-5 grid gap-2.5 border-t border-line pt-4">
          <Toggle
            label="Field lines"
            detail="Yard lines, hash marks and the LOS"
            checked={settings.showFieldLines}
            onChange={(checked) => update({ showFieldLines: checked })}
          />
          <Toggle
            label="Route index"
            detail="Printed legend with every route name"
            checked={settings.showLegend}
            onChange={(checked) => update({ showLegend: checked })}
          />
          <Toggle
            label="Monochrome print"
            detail="Black ink with solid, dashed and dotted route depths"
            checked={settings.monochrome}
            onChange={(checked) => update({ monochrome: checked })}
          />
        </div>

        <div className="mt-5 rounded-xl border border-line bg-ink-850/60 p-3">
          <p className="mono-label text-lime/80">How to read it</p>
          <p className="mt-1.5 text-[0.68rem] leading-relaxed text-slate-moss">
            1–9 are the core tree and 0 is the wheel. Each route has its own colour
            and numbered badge; monochrome printing uses solid, dashed and dotted
            lines for quick, intermediate and deep routes.
          </p>
        </div>

        <button
          className="btn btn-primary mt-5 w-full"
          onClick={exportPdf}
          disabled={exporting}
        >
          <FileDown size={15} />
          {exporting ? 'Building PDF…' : 'Export route tree PDF'}
        </button>
        <p className="mt-2 text-center text-[0.62rem] leading-relaxed text-slate-moss">
          Exact {settings.pageWidth} × {settings.pageHeight} mm page. Print at 100%
          scale.
        </p>
      </aside>
    </div>
  )
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string
  detail: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      className="flex items-start gap-3 text-left"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cx(
          'mt-0.5 flex h-[18px] w-[32px] shrink-0 items-center rounded-full border p-[2px] transition-colors',
          checked ? 'border-lime/50 bg-lime' : 'border-ink-600 bg-ink-800',
        )}
      >
        <span
          className={cx(
            'block h-3 w-3 rounded-full bg-ink-950 transition-transform',
            checked && 'translate-x-[14px] bg-lime-ink',
          )}
        />
      </span>
      <span>
        <span className="block text-[0.72rem] font-semibold text-chalk">{label}</span>
        <span className="mt-0.5 block text-[0.62rem] leading-snug text-slate-moss">{detail}</span>
      </span>
    </button>
  )
}
