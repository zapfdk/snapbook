import { Fragment, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronDown,
  FileDown,
  GripVertical,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react'
import { selectActivePlaybook, usePlaybook } from '../store/playbook'
import { NumberField } from '../components/NumberField'
import { PlayDiagram } from '../components/PlayDiagram'
import { buildWristPages, exportWristCoachPdf } from '../lib/pdf/wristCoach'
import { cx } from '../lib/files'
import type { Play, WristCoachSettings } from '../types'

/**
 * A wrist coach is worn across the wrist, so landscape sizes come first and the
 * default sheet is 150 × 100 mm. Portrait inserts are still offered for the
 * small card sizes coaches already print.
 */
const PAGE_PRESETS = [
  { id: '150x100', label: 'Wrist coach · 150 × 100 mm', width: 150, height: 100 },
  { id: '140x90', label: 'Compact wrist · 140 × 90 mm', width: 140, height: 90 },
  { id: '127x76', label: 'Index card · 127 × 76 mm', width: 127, height: 76 },
  { id: '148x105', label: 'A6 · 148 × 105 mm', width: 148, height: 105 },
  { id: '210x148', label: 'A5 · 210 × 148 mm', width: 210, height: 148 },
  { id: '279x216', label: 'US Letter · 279 × 216 mm', width: 279.4, height: 215.9 },
  { id: '297x210', label: 'A4 · 297 × 210 mm', width: 297, height: 210 },
  { id: '100x150', label: 'Wrist coach, portrait · 100 × 150 mm', width: 100, height: 150 },
  { id: '90x140', label: 'Compact wrist, portrait · 90 × 140 mm', width: 90, height: 140 },
  { id: '76x127', label: 'Index card, portrait · 76 × 127 mm', width: 76, height: 127 },
  { id: '105x148', label: 'A6, portrait · 105 × 148 mm', width: 105, height: 148 },
  { id: '210x297', label: 'A4, portrait · 210 × 297 mm', width: 210, height: 297 },
]

export function WristCoachView({ onBack }: { onBack: () => void }) {
  const playbook = usePlaybook(selectActivePlaybook)
  const wrist = usePlaybook((state) => state.wrist)
  const updateWrist = usePlaybook((state) => state.updateWrist)
  const toggleWristPlay = usePlaybook((state) => state.toggleWristPlay)
  const moveWristPlay = usePlaybook((state) => state.moveWristPlay)
  const setWristPlays = usePlaybook((state) => state.setWristPlays)

  const [query, setQuery] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  /** The card being dragged, and where it would land in the list without it. */
  const [dragging, setDragging] = useState<{ id: string; over: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)


  const playsById = useMemo(
    () => new Map(playbook.plays.map((play) => [play.id, play])),
    [playbook.plays],
  )
  const selectedPlays = wrist.selectedPlayIds
    .map((id) => playsById.get(id))
    .filter((play): play is Play => Boolean(play))

  // The card the dragged one would land in front of, or null for the end of the
  // list. The rows themselves stay put, so the drop line is what moves.
  const dropBeforeId = dragging
    ? (wrist.selectedPlayIds.filter((id) => id !== dragging.id)[dragging.over] ?? null)
    : null
  const pages = useMemo(() => buildWristPages(selectedPlays, wrist), [selectedPlays, wrist])
  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim()
    return playbook.plays.filter(
      (play) =>
        !term ||
        play.name.toLowerCase().includes(term) ||
        play.codeName.toLowerCase().includes(term),
    )
  }, [playbook.plays, query])

  const activePreset =
    PAGE_PRESETS.find(
      (preset) =>
        Math.abs(preset.width - wrist.pageWidth) < 0.5 &&
        Math.abs(preset.height - wrist.pageHeight) < 0.5,
    )?.id ?? 'custom'

  const exportPdf = () => {
    if (!selectedPlays.length) {
      setError('Add at least one play to the wrist coach first.')
      return
    }
    setError('')
    setExporting(true)
    window.setTimeout(() => {
      try {
        exportWristCoachPdf(playbook.name, selectedPlays, wrist)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PDF export failed.')
      } finally {
        setExporting(false)
      }
    }, 30)
  }

  const startCardDrag = (event: PointerEvent<HTMLSpanElement>, id: string) => {
    if (!event.isPrimary) return
    if (!listRef.current) return
    const index = wrist.selectedPlayIds.indexOf(id)
    const rest = wrist.selectedPlayIds.filter((playId) => playId !== id)
    setDragging({ id, over: index < 0 ? rest.length : index })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers may not support capture; the buttons still reorder.
    }
  }

  /** The insertion point is how many of the other cards the pointer has passed. */
  const moveCardDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (!dragging) return
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-card-row]')
    if (!rows) return
    const over = Array.from(rows)
      .filter((row) => row.dataset.cardRow !== dragging.id)
      .filter((row) => {
        const rect = row.getBoundingClientRect()
        return event.clientY > (rect.top + rect.bottom) / 2
      }).length
    if (over !== dragging.over) setDragging({ ...dragging, over })
  }

  const endCardDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (!dragging) return
    const rest = wrist.selectedPlayIds.filter((id) => id !== dragging.id)
    rest.splice(dragging.over, 0, dragging.id)
    const changed = rest.some((id, index) => id !== wrist.selectedPlayIds[index])
    setDragging(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (changed) setWristPlays(rest)
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col xl:h-[calc(100vh-68px)] xl:flex-row">
      <aside className="order-3 w-full shrink-0 overflow-y-auto border-t border-line bg-ink-900/60 p-4 xl:order-1 xl:w-[300px] xl:border-b-0 xl:border-r xl:border-t-0 xl:p-5">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-slate-moss hover:text-chalk"
          >
            <ArrowLeftRight size={13} />
            Playbook
          </button>
          <span className="mono-label">{selectedPlays.length} cards</span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.03em] text-chalk">
          Card order
        </h2>
        <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-moss">
          The order here is the order printed on your wrist coach.
        </p>

        <div
          ref={listRef}
          className={cx('mt-4 grid gap-1.5', dragging && 'select-none')}
        >
          {selectedPlays.length ? (
            selectedPlays.map((play, index) => (
              <Fragment key={play.id}>
                {dragging && dropBeforeId === play.id && (
                  <div className="h-0.5 rounded-full bg-lime/70" aria-hidden />
                )}
                <div
                  data-card-row={play.id}
                  className={cx(
                    'group flex items-center gap-2 rounded-lg border px-2 py-1.5',
                    dragging?.id === play.id
                      ? 'border-lime/60 bg-lime/[0.08] opacity-70'
                      : 'border-line bg-ink-850',
                  )}
                >
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Drag ${play.name} to reorder`}
                    title="Drag to reorder"
                    className="shrink-0 cursor-grab touch-none text-ink-600 hover:text-slate-moss active:cursor-grabbing"
                    onPointerDown={(event) => startCardDrag(event, play.id)}
                    onPointerMove={moveCardDrag}
                    onPointerUp={endCardDrag}
                    onPointerCancel={endCardDrag}
                  >
                    <GripVertical size={13} />
                  </span>
                  <span className="w-5 shrink-0 font-mono text-[0.62rem] text-slate-moss">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.72rem] font-semibold text-chalk">
                      {play.name}
                    </span>
                    {play.codeName && (
                      <span className="block font-mono text-[0.56rem] uppercase tracking-[0.08em] text-lime/75">
                        {play.codeName}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <button
                      className="icon-btn !h-6 !w-6 disabled:opacity-25"
                      onClick={() => moveWristPlay(play.id, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      className="icon-btn !h-6 !w-6 disabled:opacity-25"
                      onClick={() => moveWristPlay(play.id, 1)}
                      disabled={index === selectedPlays.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      className="icon-btn !h-6 !w-6 hover:!text-coral"
                      onClick={() => toggleWristPlay(play.id)}
                      aria-label="Remove from wrist coach"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </Fragment>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center">
              <p className="text-[0.72rem] text-slate-moss">No cards selected yet.</p>
            </div>
          )}
          {dragging && !dropBeforeId && (
            <div className="h-0.5 rounded-full bg-lime/70" aria-hidden />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="label">Add plays</h3>
          <div className="flex gap-2">
            <button
              className="text-[0.62rem] font-semibold text-lime/80 hover:text-lime"
              onClick={() => setWristPlays(playbook.plays.map((play) => play.id))}
            >
              All
            </button>
            <button
              className="text-[0.62rem] font-semibold text-slate-moss hover:text-chalk"
              onClick={() => setWristPlays([])}
            >
              None
            </button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-moss" />
          <input
            className="input !py-1.5 !pl-8 !text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a play"
            aria-label="Find a play"
          />
        </div>
        <div className="mt-2 grid gap-1">
          {filtered.map((play) => {
            const selected = wrist.selectedPlayIds.includes(play.id)
            return (
              <button
                key={play.id}
                onClick={() => toggleWristPlay(play.id)}
                className={cx(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                  selected
                    ? 'border-lime/30 bg-lime/[0.06]'
                    : 'border-transparent hover:border-line hover:bg-ink-850',
                )}
              >
                <span
                  className={cx(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border',
                    selected ? 'border-lime bg-lime text-lime-ink' : 'border-ink-600 text-transparent',
                  )}
                >
                  <Check size={10} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.72rem] font-medium text-chalk">
                    {play.name}
                  </span>
                </span>
                {!selected && <Plus size={12} className="shrink-0 text-slate-moss" />}
              </button>
            )
          })}
          {!filtered.length && (
            <p className="px-2 py-4 text-center text-[0.68rem] text-slate-moss">No plays found.</p>
          )}
        </div>
      </aside>

      <main className="order-1 min-w-0 flex-1 overflow-y-auto bg-ink-950 xl:order-2">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-ink-950/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div>
            <div className="mono-label text-lime/80">Print room</div>
            <h1 className="mt-0.5 font-display text-xl font-extrabold tracking-[-0.03em] text-chalk">
              Wrist coach
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[0.68rem] text-slate-moss sm:block">
              {selectedPlays.length} plays · {pages.length} page{pages.length === 1 ? '' : 's'} ·{' '}
              {wrist.pageWidth} × {wrist.pageHeight} mm
            </span>
            <button className="btn btn-primary" onClick={exportPdf} disabled={exporting || !selectedPlays.length}>
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
          {pages.length ? (
            <div className="mx-auto grid max-w-[1000px] gap-6 sm:grid-cols-2">
              {pages.map((page) => (
                <div key={page.index}>
                  <div
                    className="relative mx-auto w-full overflow-hidden bg-white shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
                    style={{
                      aspectRatio: `${wrist.pageWidth} / ${wrist.pageHeight}`,
                      maxWidth: wrist.pageWidth > wrist.pageHeight ? '100%' : '420px',
                      containerType: 'inline-size',
                    }}
                  >
                    <div
                      className="absolute grid"
                      style={{
                        top: `${(wrist.marginTop / wrist.pageHeight) * 100}%`,
                        bottom: `${(wrist.marginBottom / wrist.pageHeight) * 100}%`,
                        left: `${(wrist.marginLeft / wrist.pageWidth) * 100}%`,
                        right: `${(wrist.marginRight / wrist.pageWidth) * 100}%`,
                        gridTemplateColumns: `repeat(${Math.max(1, wrist.columns)}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${Math.max(1, wrist.rows)}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: Math.max(1, wrist.columns * wrist.rows) }, (_, slot) => {
                        const play = page.plays[slot]
                        if (!play) {
                          return (
                            <div
                              key={`empty-${slot}`}
                              className={wrist.showCutLines ? 'border border-[#e6e4d8]' : ''}
                            />
                          )
                        }
                        const label =
                          wrist.showCodeName && play.codeName ? play.codeName : play.name
                        const cardNumber = page.index * wrist.columns * wrist.rows + slot + 1
                        return (
                          <div
                            key={play.id}
                            className={cx(
                              'relative min-h-0 min-w-0',
                              wrist.showCutLines && 'border border-[#e6e4d8]',
                            )}
                          >
                            {wrist.showCardNumber && (
                              <span
                                className="absolute left-[3%] top-[2%] z-10 font-bold text-[#9a978a]"
                                style={{ fontSize: '1.1cqw' }}
                              >
                                {String(cardNumber).padStart(2, '0')}
                              </span>
                            )}
                            {/* The field covers the whole card, stretched to its
                                shape; the name sits on a paper plate in the corner. */}
                            <PlayDiagram
                              players={play.players}
                              className="absolute inset-0 h-full w-full"
                              paper
                              stretch
                              fieldLines={wrist.showFieldLines}
                              showLabels={wrist.showPlayerLabels}
                              labelMode={wrist.playerLabelMode}
                              routeColor={!wrist.monochrome}
                              strokeScale={1.2}
                              ariaLabel={`${play.name} wrist coach card`}
                            />
                            <div
                              className="absolute bottom-[3%] right-[3%] max-w-[72%] truncate bg-[#fffdf4] px-[1.2%] py-[0.4%] text-right font-bold uppercase leading-tight text-[#141914]"
                              style={{ fontSize: '1.8cqw', letterSpacing: '0.01em' }}
                            >
                              {label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mt-2 text-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-moss">
                    Page {page.index + 1} / {pages.length}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-850 text-fog">
                <Printer size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-chalk">Build your call sheet</h2>
              <p className="mt-1 max-w-sm text-sm text-fog">
                Add plays from the left, choose your insert size, then export a
                print-ready PDF.
              </p>
            </div>
          )}
        </div>
      </main>

      <aside className="order-2 w-full shrink-0 overflow-y-auto border-t border-line bg-ink-900/60 p-4 xl:order-3 xl:w-[320px] xl:border-l xl:border-t-0 xl:p-5">
        <div className="flex items-center justify-between">
          <h2 className="label">Print setup</h2>
          <span className="font-mono text-[0.6rem] text-slate-moss">
            {wrist.pageWidth >= wrist.pageHeight ? 'Landscape' : 'Portrait'} ·{' '}
            {wrist.columns} × {wrist.rows}
          </span>
        </div>

        <label className="mt-3 grid gap-1.5">
          <span className="label">Insert size</span>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={activePreset}
              onChange={(event) => {
                const preset = PAGE_PRESETS.find((item) => item.id === event.target.value)
                if (preset) {
                  updateWrist({ pageWidth: preset.width, pageHeight: preset.height })
                }
              }}
            >
              {PAGE_PRESETS.map((preset) => (
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
              min={30}
              max={500}
              className="input font-mono"
              value={wrist.pageWidth}
              onChange={(pageWidth) => updateWrist({ pageWidth })}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Height mm</span>
            <NumberField
              min={30}
              max={500}
              className="input font-mono"
              value={wrist.pageHeight}
              onChange={(pageHeight) => updateWrist({ pageHeight })}
            />
          </label>
          <button
            className="icon-btn mb-0.5 border border-line"
            onClick={() =>
              updateWrist({ pageWidth: wrist.pageHeight, pageHeight: wrist.pageWidth })
            }
            title="Swap orientation"
            aria-label="Swap page orientation"
          >
            <ArrowLeftRight size={15} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stepper
            label="Columns"
            value={wrist.columns}
            onChange={(value) => updateWrist({ columns: value })}
          />
          <Stepper
            label="Rows"
            value={wrist.rows}
            onChange={(value) => updateWrist({ rows: value })}
          />
        </div>

        <div className="mt-5">
          <span className="label">Safe margins (mm)</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ['Top', 'marginTop'],
                ['Bottom', 'marginBottom'],
                ['Left', 'marginLeft'],
                ['Right', 'marginRight'],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="grid gap-1">
                <span className="text-[0.62rem] text-slate-moss">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  className="input !py-1.5 font-mono !text-xs"
                  value={wrist[key]}
                  onChange={(event) =>
                    updateWrist({
                      [key]: Math.max(0, Math.min(40, Number(event.target.value) || 0)),
                    } as Partial<WristCoachSettings>)
                  }
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[0.62rem] leading-relaxed text-slate-moss">
            The dashed border in physical coaches covers this area, so keep it clear.
          </p>
        </div>

        <div className="mt-5 grid gap-2.5 border-t border-line pt-4">
          <Toggle
            label="Use code names"
            detail="Print the wrist code instead of the play name"
            checked={wrist.showCodeName}
            onChange={(checked) => updateWrist({ showCodeName: checked })}
          />
          <Toggle
            label="Card numbers"
            detail="Small sequence number on each card"
            checked={wrist.showCardNumber}
            onChange={(checked) => updateWrist({ showCardNumber: checked })}
          />
          <Toggle
            label="Field lines"
            detail="Yard lines and line of scrimmage"
            checked={wrist.showFieldLines}
            onChange={(checked) => updateWrist({ showFieldLines: checked })}
          />
          <Toggle
            label="Player labels"
            detail="Show position labels inside markers"
            checked={wrist.showPlayerLabels}
            onChange={(checked) => updateWrist({ showPlayerLabels: checked })}
          />
          <Toggle
            label="Cut guides"
            detail="Hairline borders around each card"
            checked={wrist.showCutLines}
            onChange={(checked) => updateWrist({ showCutLines: checked })}
          />
          <Toggle
            label="Monochrome print"
            detail="Black routes and markers, ink-friendly"
            checked={wrist.monochrome}
            onChange={(checked) => updateWrist({ monochrome: checked })}
          />
        </div>

        {wrist.showPlayerLabels && (
          <label className="mt-4 grid gap-1.5">
            <span className="label">Label content</span>
            <div className="relative">
              <select
                className="input appearance-none pr-8"
                value={wrist.playerLabelMode}
                onChange={(event) =>
                  updateWrist({
                    playerLabelMode: event.target.value as 'label' | 'number',
                  })
                }
              >
                <option value="label">Position label (C, QB, WR)</option>
                <option value="number">Jersey number when set</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-moss"
              />
            </div>
          </label>
        )}

        <div className="mt-5 flex items-center justify-between rounded-lg border border-line bg-ink-850 px-3 py-2">
          <div>
            <div className="text-[0.68rem] font-semibold text-chalk">Ink</div>
            <div className="text-[0.6rem] text-slate-moss">Names & markers</div>
          </div>
          <input
            type="color"
            value={wrist.inkColor}
            onChange={(event) => updateWrist({ inkColor: event.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
            aria-label="Ink color"
          />
        </div>

        <button
          className="btn btn-primary mt-5 w-full"
          onClick={exportPdf}
          disabled={exporting || !selectedPlays.length}
        >
          <FileDown size={15} />
          {exporting ? 'Building PDF…' : 'Export wrist coach PDF'}
        </button>
        <p className="mt-2 text-center text-[0.62rem] leading-relaxed text-slate-moss">
          Exact {wrist.pageWidth} × {wrist.pageHeight} mm pages. Print at 100% scale.
        </p>

        <button
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-[0.64rem] font-semibold text-slate-moss hover:text-chalk"
          onClick={onBack}
        >
          <Check size={12} /> Done editing
        </button>
      </aside>
    </div>
  )
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-1.5 flex items-center rounded-lg border border-line bg-ink-900">
        <button
          className="grid h-8 w-8 place-items-center text-fog hover:text-chalk disabled:opacity-30"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="flex-1 text-center font-mono text-[0.76rem] text-chalk">{value}</span>
        <button
          className="grid h-8 w-8 place-items-center text-fog hover:text-chalk disabled:opacity-30"
          onClick={() => onChange(Math.min(6, value + 1))}
          disabled={value >= 6}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
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
