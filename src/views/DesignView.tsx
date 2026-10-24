import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  CornerDownLeft,
  Eraser,
  Layers,
  MousePointer2,
  PenLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2,
  Undo2,
  X,
} from 'lucide-react'
import { usePlaybook } from '../store/playbook'
import { PLAYER_COLORS } from '../data/defaults'
import { FieldCanvas } from '../components/FieldCanvas'
import { RouteGlyph } from '../components/RouteGlyph'
import { Modal } from '../components/Modal'
import { cx, formatDate } from '../lib/files'
import { routeLength } from '../lib/geometry'
import {
  findPlayerNear,
  matchRoutePreset,
  playerRouteSign,
  polylineLength,
  simplifyFreehandRoute,
} from '../lib/playRecognition'
import type { Play, Point, RoutePoint } from '../types'

type SketchStatus = {
  tone: 'match' | 'freehand' | 'miss'
  text: string
}

interface DesignViewProps {
  play: Play
  onBack: () => void
}

export function DesignView({ play, onBack }: DesignViewProps) {
  const updatePlay = usePlaybook((state) => state.updatePlay)
  const updatePlayer = usePlaybook((state) => state.updatePlayer)
  const movePlayer = usePlaybook((state) => state.movePlayer)
  const setPlayerRoute = usePlaybook((state) => state.setPlayerRoute)
  const clearPlayerRoute = usePlaybook((state) => state.clearPlayerRoute)
  const applyRoutePreset = usePlaybook((state) => state.applyRoutePreset)
  const duplicatePlay = usePlaybook((state) => state.duplicatePlay)
  const deletePlay = usePlaybook((state) => state.deletePlay)
  const createFormationFromPlay = usePlaybook((state) => state.createFormationFromPlay)
  const addCategory = usePlaybook((state) => state.addCategory)
  const togglePlayCategory = usePlaybook((state) => state.togglePlayCategory)
  const playbook = usePlaybook((state) => state.playbook)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<'move' | 'route' | 'sketch'>('move')
  const [draft, setDraft] = useState<RoutePoint[] | null>(null)
  const [saveFormationOpen, setSaveFormationOpen] = useState(false)
  const [formationName, setFormationName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [tagInputOpen, setTagInputOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sketchStatus, setSketchStatus] = useState<SketchStatus | null>(null)

  const selectedPlayer = play.players.find((player) => player.id === selectedId) ?? null
  const formation = playbook.formations.find((item) => item.id === play.formationId)
  const categories = playbook.categories

  useEffect(() => {
    setSelectedId(null)
    setTool('move')
    setDraft(null)
    setSketchStatus(null)
  }, [play.id])

  const finishDrawing = () => {
    if (draft !== null && selectedId) {
      setPlayerRoute(play.id, selectedId, draft)
    }
    setDraft(null)
    setTool('move')
  }

  const cancelDrawing = () => {
    setDraft(null)
    setTool('move')
  }

  const startDrawing = () => {
    if (!selectedPlayer) {
      setHelpOpen(true)
      return
    }
    setDraft(selectedPlayer.route ? selectedPlayer.route.points.map((point) => ({ ...point })) : [])
    setTool('route')
  }

  const startSketching = () => {
    if (draft !== null) finishDrawing()
    setSelectedId(null)
    setSketchStatus(null)
    setTool('sketch')
  }

  const handleSketch = (points: Point[]) => {
    if (points.length < 2) return

    const player = findPlayerNear(play.players, points[0])
    if (!player) {
      setSketchStatus({ tone: 'miss', text: 'Start the stroke on a player marker.' })
      return
    }

    const relative = points.map((point) => ({
      x: point.x - player.pos.x,
      y: point.y - player.pos.y,
    }))
    if (polylineLength(relative) < 2.2) {
      setSketchStatus({ tone: 'miss', text: 'Draw a little farther to set a route.' })
      return
    }

    const match = matchRoutePreset(relative, playerRouteSign(player), playbook.routes)
    if (match) {
      applyRoutePreset(play.id, player.id, match.preset.id)
      setSelectedId(player.id)
      setSketchStatus({ tone: 'match', text: `${player.label} matched ${match.preset.name}` })
      return
    }

    const route = simplifyFreehandRoute(relative)
    if (!route.length) {
      setSketchStatus({ tone: 'miss', text: 'That stroke was too short to keep.' })
      return
    }

    setPlayerRoute(play.id, player.id, route)
    setSelectedId(player.id)
    setSketchStatus({ tone: 'freehand', text: `${player.label} kept as a freehand route` })
  }

  const removeLastDraftPoint = () => {
    if (!draft) return
    setDraft(draft.length ? draft.slice(0, -1) : [])
  }

  const nudge = (dx: number, dy: number) => {
    if (!selectedPlayer) return
    movePlayer(play.id, selectedPlayer.id, {
      x: Number(Math.min(12.1, Math.max(-12.1, selectedPlayer.pos.x + dx)).toFixed(2)),
      y: Number(Math.min(16.4, Math.max(-7.1, selectedPlayer.pos.y + dy)).toFixed(2)),
    })
  }

  const shortcutState = useRef({ finishDrawing, startDrawing, cancelDrawing, nudge })
  shortcutState.current = { finishDrawing, startDrawing, cancelDrawing, nudge }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey) return
      const state = shortcutState.current
      if (event.key === 'Escape') {
        if (draft !== null) {
          event.preventDefault()
          state.cancelDrawing()
        } else {
          setSelectedId(null)
        }
        return
      }
      if (event.key === 'Enter' && draft !== null) {
        event.preventDefault()
        state.finishDrawing()
        return
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && draft !== null) {
        event.preventDefault()
        removeLastDraftPoint()
        return
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        if (draft !== null) state.finishDrawing()
        else state.startDrawing()
        return
      }
      if (!selectedId || draft !== null) return
      const step = event.shiftKey ? 0.1 : 0.5
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        state.nudge(-step, 0)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        state.nudge(step, 0)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        state.nudge(0, step)
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        state.nudge(0, -step)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [draft, selectedId])

  const tags = useMemo(
    () => categories.filter((category) => play.categories.includes(category.id)),
    [categories, play.categories],
  )

  const addTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    const id = addCategory(trimmed)
    if (!play.categories.includes(id)) {
      togglePlayCategory(play.id, id)
    }
    setNewTag('')
    setTagInputOpen(false)
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col xl:h-[calc(100vh-68px)] xl:flex-row">
      <aside className="order-2 w-full shrink-0 overflow-y-auto border-t border-line bg-ink-900/60 p-4 xl:order-1 xl:w-[296px] xl:border-b-0 xl:border-r xl:border-t-0 xl:p-5">
        <button
          onClick={onBack}
          className="mb-4 hidden items-center gap-1.5 text-[0.72rem] font-semibold text-slate-moss transition-colors hover:text-chalk xl:flex"
        >
          <ArrowLeft size={14} />
          All plays
        </button>

        <div className="hidden gap-2 xl:grid">
          <input
            value={play.name}
            onChange={(event) => updatePlay(play.id, { name: event.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-0 py-0.5 font-display text-[1.55rem] font-extrabold leading-tight tracking-[-0.03em] text-chalk outline-none transition-colors hover:border-line hover:bg-ink-850 hover:px-2 focus:border-line focus:bg-ink-850 focus:px-2"
            aria-label="Play name"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mono-label">Code</span>
            <input
              value={play.codeName}
              onChange={(event) =>
                updatePlay(play.id, { codeName: event.target.value.toUpperCase() })
              }
              placeholder="NONE"
              maxLength={12}
              className="w-24 rounded-md border border-line bg-ink-850 px-2 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-lime outline-none focus:border-lime/60"
              aria-label="Wrist coach code name"
            />
            <span className="ml-auto text-[0.62rem] text-slate-moss">
              {formatDate(play.updatedAt)}
            </span>
          </div>
        </div>

        <div className="hidden flex-wrap gap-1.5 xl:mt-4 xl:flex">
          <span className="chip">
            <Layers size={11} />
            {formation?.name ?? 'Custom formation'}
          </span>
          {tags.map((category) => (
            <span key={category.id} className="chip">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </span>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="label">Route library</span>
          <button
            className="text-[0.64rem] font-semibold text-lime/80 hover:text-lime"
            onClick={() => setHelpOpen(true)}
          >
            How it works
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-2.5 py-2">
          {selectedPlayer ? (
            <>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedPlayer.color }}
              />
              <span className="text-[0.72rem] font-semibold text-chalk">
                {selectedPlayer.label}
              </span>
              <span className="truncate text-[0.65rem] text-slate-moss">
                {selectedPlayer.role}
              </span>
            </>
          ) : (
            <span className="text-[0.68rem] text-slate-moss">
              Select a player to apply a route
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {playbook.routes.map((preset) => (
            <button
              key={preset.id}
              disabled={!selectedPlayer}
              onClick={() => selectedPlayer && applyRoutePreset(play.id, selectedPlayer.id, preset.id)}
              className={cx(
                'group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-left transition-colors',
                selectedPlayer
                  ? 'border-line bg-ink-850/80 hover:border-lime/40 hover:bg-lime/[0.05]'
                  : 'cursor-not-allowed border-line/60 bg-ink-850/40 opacity-45',
              )}
            >
              <RouteGlyph
                points={preset.points}
                className="h-8 w-7 shrink-0 text-fog transition-colors group-hover:text-lime"
              />
              <span className="truncate text-[0.68rem] font-semibold text-fog group-hover:text-chalk">
                {preset.name}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-line bg-ink-850/60 p-3">
          <p className="text-[0.68rem] leading-relaxed text-slate-moss">
            Routes mirror automatically for left and right receivers. Drag the
            round handles to reshape a route point.
          </p>
        </div>
      </aside>

      <main className="order-1 flex min-w-0 flex-1 flex-col bg-ink-950 xl:order-2">
        <div className="flex items-start gap-2 border-b border-line px-3 py-2.5 sm:px-4 xl:hidden">
          <button
            onClick={onBack}
            className="icon-btn mt-0.5 shrink-0"
            aria-label="Back to playbook"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={play.name}
              onChange={(event) => updatePlay(play.id, { name: event.target.value })}
              className="w-full rounded-md border border-transparent bg-transparent px-0 py-0.5 font-display text-[1.3rem] font-extrabold leading-tight tracking-[-0.03em] text-chalk outline-none hover:border-line hover:bg-ink-850 hover:px-2 focus:border-line focus:bg-ink-850 focus:px-2"
              aria-label="Play name"
            />
            <div className="mt-1 flex items-center gap-1.5">
              <span className="mono-label">Code</span>
              <input
                value={play.codeName}
                onChange={(event) =>
                  updatePlay(play.id, { codeName: event.target.value.toUpperCase() })
                }
                placeholder="NONE"
                maxLength={12}
                className="w-24 rounded-md border border-line bg-ink-850 px-2 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-lime outline-none focus:border-lime/60"
                aria-label="Wrist coach code name"
              />
              <span className="ml-auto text-[0.62rem] text-slate-moss">
                {formatDate(play.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
          <div className="flex items-center rounded-lg border border-line bg-ink-900 p-0.5">
            <button
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors',
                tool === 'move' ? 'bg-ink-750 text-chalk' : 'text-slate-moss hover:text-chalk',
              )}
              onClick={() => {
                if (draft !== null) finishDrawing()
                setTool('move')
              }}
            >
              <MousePointer2 size={13} />
              Move
            </button>
            <button
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors',
                tool === 'route' ? 'bg-lime text-lime-ink' : 'text-slate-moss hover:text-chalk',
              )}
              onClick={startDrawing}
            >
              <PenLine size={13} />
              Draw route
            </button>
            <button
              className={cx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors',
                tool === 'sketch' ? 'bg-lime text-lime-ink' : 'text-slate-moss hover:text-chalk',
              )}
              onClick={startSketching}
              title="Experimental: sketch a route and snap it to a preset"
              aria-label="Sketch a route (experimental)"
            >
              <Wand2 size={13} />
              <span>Sketch</span>
            </button>
          </div>

          {draft !== null ? (
            <div className="flex items-center gap-1.5">
              <span className="hidden items-center gap-1 rounded-md border border-lime/25 bg-lime/10 px-2 py-1 text-[0.64rem] font-semibold text-lime sm:flex">
                <CornerDownLeft size={11} /> Enter
              </span>
              <button className="btn btn-secondary !px-2.5 !py-1.5" onClick={removeLastDraftPoint}>
                <Undo2 size={13} />
                <span className="hidden sm:inline">Undo point</span>
              </button>
              <button className="btn btn-primary !px-2.5 !py-1.5" onClick={finishDrawing}>
                <Check size={13} />
                Done
              </button>
              <button className="icon-btn" onClick={cancelDrawing} aria-label="Cancel route">
                <X size={15} />
              </button>
            </div>
          ) : tool === 'sketch' ? (
            <span className="hidden text-[0.66rem] text-slate-moss lg:block">
              Draw from a player · release to snap or keep freehand
            </span>
          ) : (
            <span className="hidden text-[0.66rem] text-slate-moss lg:block">
              Click the field to add route points · double back with Undo
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <button
              className="btn btn-secondary !px-2.5 !py-1.5"
              onClick={() => {
                setFormationName(`${play.name} formation`)
                setSaveFormationOpen(true)
              }}
              title="Save this alignment as a formation"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Save formation</span>
            </button>
            <button
              className="icon-btn"
              onClick={() => duplicatePlay(play.id)}
              title="Duplicate play"
              aria-label="Duplicate play"
            >
              <Copy size={15} />
            </button>
            <button
              className="icon-btn hover:!bg-coral/10 hover:!text-coral"
              onClick={() => setDeleteOpen(true)}
              title="Delete play"
              aria-label="Delete play"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {tool === 'sketch' && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-lime/20 bg-lime/[0.055] px-3 py-2 text-[0.68rem] leading-relaxed text-fog sm:px-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-lime">
              <Wand2 size={13} />
              Experimental sketch
            </span>
            <span className="hidden sm:inline">
              Draw one route from each player. We&apos;ll snap the closest preset, or keep
              your line as a freehand route.
            </span>
            <span className="sm:hidden">Draw from a player, then release.</span>
            {sketchStatus && (
              <span
                aria-live="polite"
                className={cx(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold',
                  sketchStatus.tone === 'match'
                    ? 'border-lime/30 bg-lime/10 text-lime'
                    : sketchStatus.tone === 'freehand'
                      ? 'border-[#82B7FF]/30 bg-[#82B7FF]/10 text-[#82B7FF]'
                      : 'border-coral/30 bg-coral/10 text-coral',
                )}
              >
                {sketchStatus.tone === 'miss' ? (
                  <TriangleAlert size={11} />
                ) : sketchStatus.tone === 'freehand' ? (
                  <PenLine size={11} />
                ) : (
                  <Sparkles size={11} />
                )}
                {sketchStatus.text}
              </span>
            )}
          </div>
        )}

        <div className="relative flex flex-1 items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 grid-noise opacity-[0.35]" />
          <div
            className={cx(
              'relative w-full max-w-[720px] overflow-hidden rounded-2xl border shadow-[0_30px_80px_rgba(0,0,0,0.45)]',
              tool === 'sketch' ? 'border-lime/35' : 'border-[#2c4a36]',
            )}
          >
            <FieldCanvas
              play={play}
              selectedId={selectedId}
              tool={tool}
              draft={draft}
              onSelect={setSelectedId}
              onMovePlayer={(id, pos) => movePlayer(play.id, id, pos)}
              onAddDraftPoint={(point) => setDraft((current) => [...(current ?? []), point])}
              onSetRoutePoints={(id, points) => setPlayerRoute(play.id, id, points)}
              onSketch={handleSketch}
            />
          </div>

          {draft !== null && (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-lime/25 bg-ink-950/90 px-3 py-1.5 text-[0.66rem] font-medium text-lime shadow-lg backdrop-blur">
              Click to place points · Enter to finish · Esc to cancel
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[0.62rem] text-slate-moss">
          <span>
            {tool === 'sketch' ? 'Sketch from a player marker' : 'Drag players to align'}
          </span>
          <span className="hidden sm:inline">
            {tool === 'sketch'
              ? 'Release to snap or freehand'
              : 'Arrow keys nudge · Shift for 0.1 yd'}
          </span>
          <span className="hidden md:inline">
            {tool === 'sketch' ? 'Experimental · best effort' : 'R draws a route'}
          </span>
          <span className="ml-auto font-mono uppercase tracking-[0.08em]">
            5v5 · 25 yd field
          </span>
        </div>
      </main>

      <aside className="order-3 w-full shrink-0 overflow-y-auto border-t border-line bg-ink-900/60 p-4 xl:order-3 xl:w-[318px] xl:border-l xl:border-t-0 xl:p-5">
        {selectedPlayer ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="label">Selected player</span>
              <button
                className="text-[0.64rem] font-semibold text-slate-moss hover:text-chalk"
                onClick={() => setSelectedId(null)}
              >
                Deselect
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-ink-850 p-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold text-ink-950"
                style={{ backgroundColor: selectedPlayer.color }}
              >
                {selectedPlayer.label}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[0.82rem] font-semibold text-chalk">
                  {selectedPlayer.role}
                </div>
                <div className="mt-0.5 text-[0.64rem] text-slate-moss">
                  {selectedPlayer.route
                    ? `${selectedPlayer.route.points.length} point${
                        selectedPlayer.route.points.length === 1 ? '' : 's'
                      } · ${routeLength(selectedPlayer.route).toFixed(1)} yd`
                    : 'No route assigned'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="label">Label</span>
                <input
                  className="input font-mono uppercase"
                  value={selectedPlayer.label}
                  maxLength={4}
                  onChange={(event) =>
                    updatePlayer(play.id, selectedPlayer.id, {
                      label: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="label">Number</span>
                <input
                  className="input font-mono"
                  type="number"
                  min={0}
                  max={99}
                  value={selectedPlayer.number ?? ''}
                  placeholder="—"
                  onChange={(event) => {
                    const value = event.target.value
                    updatePlayer(play.id, selectedPlayer.id, {
                      number: value === '' ? null : Math.max(0, Math.min(99, Number(value))),
                    })
                  }}
                />
              </label>
            </div>
            <label className="mt-3 grid gap-1.5">
              <span className="label">Position name</span>
              <input
                className="input"
                value={selectedPlayer.role}
                onChange={(event) =>
                  updatePlayer(play.id, selectedPlayer.id, { role: event.target.value })
                }
              />
            </label>

            <div className="mt-4">
              <span className="label">Marker color</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLAYER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updatePlayer(play.id, selectedPlayer.id, { color })}
                    className={cx(
                      'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                      selectedPlayer.color === color
                        ? 'border-white'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Set color ${color}`}
                  >
                    {selectedPlayer.color === color && (
                      <Check size={12} className="mx-auto text-ink-950" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <button className="btn btn-secondary w-full justify-start" onClick={startDrawing}>
                <PenLine size={14} />
                {selectedPlayer.route ? 'Edit route points' : 'Draw route'}
              </button>
              {selectedPlayer.route && (
                <button
                  className="btn btn-ghost w-full justify-start !text-coral/90 hover:!bg-coral/10"
                  onClick={() => {
                    clearPlayerRoute(play.id, selectedPlayer.id)
                    setDraft(null)
                    setTool('move')
                  }}
                >
                  <Eraser size={14} />
                  Clear route
                </button>
              )}
            </div>

            <p className="mt-4 text-[0.66rem] leading-relaxed text-slate-moss">
              Tip: draw straight segments point by point. The preset library adds
              curved, game-ready routes instantly.
            </p>
          </div>
        ) : (
          <div>
            <span className="label">Play details</span>
            <div className="mt-3 rounded-xl border border-line bg-ink-850 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.78rem] font-semibold text-chalk">
                  {formation?.name ?? 'Custom formation'}
                </span>
                <button
                  className="text-[0.62rem] font-semibold text-lime/80 hover:text-lime"
                  onClick={() => selectedId === null && setHelpOpen(true)}
                >
                  Tips
                </button>
              </div>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-moss">
                Select a player on the field to edit their alignment, label and
                route.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center justify-between">
            <span className="label">Tags</span>
            <button
              className="flex items-center gap-1 text-[0.64rem] font-semibold text-lime/80 hover:text-lime"
              onClick={() => setTagInputOpen((open) => !open)}
            >
              <Plus size={12} /> New tag
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {categories.map((category) => {
              const active = play.categories.includes(category.id)
              return (
                <button
                  key={category.id}
                  onClick={() => togglePlayCategory(play.id, category.id)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold transition-colors',
                    active
                      ? 'border-lime/40 bg-lime/10 text-lime'
                      : 'border-line bg-ink-850 text-slate-moss hover:text-chalk',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                  {active && <Check size={10} />}
                </button>
              )
            })}
            {!categories.length && (
              <span className="text-[0.68rem] text-slate-moss">No tags yet.</span>
            )}
          </div>
          {tagInputOpen && (
            <div className="mt-2 flex gap-1.5">
              <input
                className="input !py-1.5 !text-xs"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                placeholder="e.g. Goal line"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTag()
                  if (event.key === 'Escape') setTagInputOpen(false)
                }}
                autoFocus
              />
              <button
                className="btn btn-primary !px-2.5 !py-1.5"
                onClick={addTag}
                disabled={!newTag.trim()}
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="grid gap-1.5">
            <span className="label">Coaching notes</span>
            <textarea
              className="input min-h-24 resize-y leading-relaxed"
              value={play.notes}
              onChange={(event) => updatePlay(play.id, { notes: event.target.value })}
              placeholder="Reads, reminders, coaching points…"
            />
          </label>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-ink-850/60 p-3">
          <div className="flex items-center gap-2 text-[0.7rem] font-semibold text-chalk">
            <Layers size={13} className="text-lime" />
            Wrist coach ready
          </div>
          <p className="mt-1 text-[0.66rem] leading-relaxed text-slate-moss">
            This play is already available in the wrist coach builder with its
            current code name.
          </p>
        </div>
      </aside>

      <Modal
        open={saveFormationOpen}
        onClose={() => setSaveFormationOpen(false)}
        title="Save alignment as a formation"
        description="Formations are reusable starting points for future plays."
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setSaveFormationOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                createFormationFromPlay(play.id, formationName)
                setSaveFormationOpen(false)
              }}
            >
              Save formation
            </button>
          </div>
        }
      >
        <label className="grid gap-2">
          <span className="label">Formation name</span>
          <input
            className="input"
            value={formationName}
            onChange={(event) => setFormationName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                createFormationFromPlay(play.id, formationName)
                setSaveFormationOpen(false)
              }
            }}
          />
        </label>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete play?"
        description={`“${play.name}” will be removed from the playbook and wrist coach.`}
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
              Keep play
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                deletePlay(play.id)
                setDeleteOpen(false)
                onBack()
              }}
            >
              <Trash2 size={14} />
              Delete play
            </button>
          </div>
        }
      >
        <p className="text-sm text-fog">This can’t be undone.</p>
      </Modal>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Drawing routes"
        description="A fast workflow for getting plays from your head onto paper."
      >
        <ol className="grid gap-3 text-sm text-fog">
          <li className="flex gap-3">
            <span className="mono-label mt-0.5 text-lime">01</span>
            Select any player on the field.
          </li>
          <li className="flex gap-3">
            <span className="mono-label mt-0.5 text-lime">02</span>
            Tap a route from the library for a ready-made stem, or choose Draw
            route and click the field to place points.
          </li>
          <li className="flex gap-3">
            <span className="mono-label mt-0.5 text-lime">03</span>
            Drag the round handles to adjust a route point. Press Enter to finish.
          </li>
          <li className="flex gap-3">
            <span className="mono-label mt-0.5 text-lime">04</span>
            Use Save formation to reuse an alignment in your next play.
          </li>
          <li className="flex gap-3">
            <span className="mono-label mt-0.5 text-lime">05</span>
            In the experimental Sketch mode, draw from a player marker and release. We
            match the closest preset, or keep your line as a freehand route.
          </li>
        </ol>
        <div className="mt-5 flex justify-end">
          <button className="btn btn-primary" onClick={() => setHelpOpen(false)}>
            Got it
          </button>
        </div>
      </Modal>

    </div>
  )
}
