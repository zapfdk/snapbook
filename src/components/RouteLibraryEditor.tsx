import { useEffect, useMemo, useState } from 'react'
import { Check, Eraser, Minus, PenLine, Undo2, X } from 'lucide-react'
import { FieldCanvas } from './FieldCanvas'
import { Modal } from './Modal'
import { normalizeHex } from '../lib/color'
import { cx } from '../lib/files'
import { withCurve } from '../lib/geometry'
import {
  ROUTE_GROUPS,
  ROUTE_GROUP_COLORS,
  formatRouteBreak,
  routeBreak,
  routeDepth,
} from '../data/routeLibrary'
import {
  createId,
  type LibraryRoute,
  type Play,
  type Player,
  type RouteGroup,
  type RoutePoint,
} from '../types'

interface RouteLibraryEditorProps {
  open: boolean
  route: LibraryRoute | null
  isNew: boolean
  /** Names that cannot be reused, excluding the route being edited. */
  existingNames: string[]
  onClose: () => void
  onSave: (route: LibraryRoute) => void
}

const blankRoute = (): LibraryRoute => ({
  id: createId(),
  name: '',
  group: 'Quick game',
  color: ROUTE_GROUP_COLORS['Quick game'],
  note: '',
  points: [],
})

const copyPoints = (points: RoutePoint[]) =>
  points.map((point) => ({
    ...point,
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  }))

export function RouteLibraryEditor({
  open,
  route,
  isNew,
  existingNames,
  onClose,
  onSave,
}: RouteLibraryEditorProps) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState<RouteGroup>('Quick game')
  const [color, setColor] = useState(ROUTE_GROUP_COLORS['Quick game'])
  const [note, setNote] = useState('')
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [tool, setTool] = useState<'move' | 'route'>('move')
  const [draft, setDraft] = useState<RoutePoint[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const base = route ?? blankRoute()
    setName(base.name)
    setGroup(base.group)
    setColor(base.color)
    setNote(base.note)
    setPoints(copyPoints(base.points))
    setTool('move')
    setDraft(null)
    setError('')
  }, [open, route])

  const selectedId = 'route-library-origin'

  const preview = useMemo<Play>(() => {
    const player: Player = {
      id: selectedId,
      role: 'Receiver',
      label: 'WR',
      number: null,
      color,
      pos: { x: 0, y: 0 },
      route: points.length ? { id: 'route-library-preview', points } : null,
    }
    return {
      id: 'route-library-preview',
      name: name.trim() || 'Route under construction',
      codeName: '',
      formationId: '',
      players: [player],
      categories: [],
      notes: '',
      createdAt: '',
      updatedAt: '',
    }
  }, [color, name, points, selectedId])

  const changeGroup = (next: RouteGroup) => {
    if (color.toLowerCase() === ROUTE_GROUP_COLORS[group].toLowerCase()) {
      setColor(ROUTE_GROUP_COLORS[next])
    }
    setGroup(next)
  }

  const startDrawing = () => {
    setDraft(copyPoints(points))
    setTool('route')
    setError('')
  }

  const finishDrawing = () => {
    if (draft !== null) setPoints(copyPoints(draft))
    setDraft(null)
    setTool('move')
  }

  const cancelDrawing = () => {
    setDraft(null)
    setTool('move')
  }

  const removeLastPoint = () => {
    if (draft !== null) {
      setDraft(draft.length ? draft.slice(0, -1) : [])
      return
    }
    setPoints(points.length ? points.slice(0, -1) : [])
  }

  const clearPoints = () => {
    setDraft(null)
    setTool('move')
    setPoints([])
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give this route a name.')
      return
    }
    if (existingNames.some((item) => item.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError('Another route already uses that name.')
      return
    }
    const finalPoints = draft ?? points
    if (!finalPoints.length) {
      setError('Add at least one route point.')
      return
    }
    onSave({
      id: route?.id ?? createId(),
      name: trimmed,
      group,
      color: normalizeHex(color),
      note: note.trim(),
      points: copyPoints(finalPoints),
    })
  }

  const depth = points.length ? routeDepth(points) : 0
  const breakDepth = points.length ? routeBreak(points) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New route' : 'Edit route'}
      description="Routes are reusable presets for every play in this playbook."
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.68rem] text-slate-moss">
            {points.length} point{points.length === 1 ? '' : 's'} · {depth} yd deep
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              <Check size={14} />
              {isNew ? 'Add route' : 'Save route'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_5.5rem]">
          <label className="grid gap-1.5">
            <span className="label">Route name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="e.g. Deep Cross"
              data-autofocus
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Group</span>
            <select
              className="input"
              value={group}
              onChange={(event) => changeGroup(event.target.value as RouteGroup)}
            >
              {ROUTE_GROUPS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="label">Color</span>
            <input
              type="color"
              value={normalizeHex(color)}
              onChange={(event) => setColor(event.target.value)}
              className="h-[38px] w-full cursor-pointer rounded-lg border border-line bg-ink-850 p-1"
              aria-label="Route colour"
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] lg:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-line bg-ink-900 p-0.5">
                <button
                  className={cx(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors',
                    tool === 'move'
                      ? 'bg-ink-750 text-chalk'
                      : 'text-slate-moss hover:text-chalk',
                  )}
                  onClick={() => {
                    if (draft !== null) finishDrawing()
                    else setTool('move')
                  }}
                >
                  <PenLine size={12} />
                  Shape
                </button>
                <button
                  className={cx(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.7rem] font-semibold transition-colors',
                    tool === 'route'
                      ? 'bg-lime text-lime-ink'
                      : 'text-slate-moss hover:text-chalk',
                  )}
                  onClick={startDrawing}
                >
                  <PenLine size={12} />
                  Draw points
                </button>
              </div>
              <button className="btn btn-secondary !px-2.5 !py-1.5" onClick={removeLastPoint}>
                <Undo2 size={12} />
                <span className="hidden sm:inline">Undo point</span>
              </button>
              <button
                className="btn btn-secondary !px-2.5 !py-1.5"
                onClick={() =>
                  setPoints((current) => current.map((point) => withCurve(point, 0)))
                }
                disabled={!points.some((point) => point.curve)}
                title="Make every segment straight"
              >
                <Minus size={12} />
                <span className="hidden sm:inline">Straighten</span>
              </button>
              <button className="btn btn-secondary !px-2.5 !py-1.5" onClick={clearPoints}>
                <Eraser size={12} />
                <span className="hidden sm:inline">Clear</span>
              </button>
              {draft !== null && (
                <>
                  <button className="btn btn-primary !px-2.5 !py-1.5" onClick={finishDrawing}>
                    <Check size={12} />
                    Done
                  </button>
                  <button
                    className="icon-btn"
                    onClick={cancelDrawing}
                    aria-label="Cancel drawing"
                    title="Cancel drawing"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>

            <div className="relative aspect-square overflow-hidden rounded-xl border border-line">
              <FieldCanvas
                play={preview}
                selectedId={selectedId}
                tool={tool}
                draft={draft}
                onSelect={() => undefined}
                onMovePlayer={() => undefined}
                onAddDraftPoint={(point) =>
                  setDraft((current) => [...(current ?? []), point])
                }
                onSetRoutePoints={(_, next) => {
                  setDraft(null)
                  setTool('move')
                  setPoints(next)
                }}
                onSketch={() => undefined}
                lockPlayers
                curveHandles
              />
            </div>
            <p className="mt-2 text-[0.64rem] leading-relaxed text-slate-moss">
              {draft !== null
                ? 'Click the field to add points. Drag handles to refine, then choose Done.'
                : 'Drag the round handles to reshape this route, or the dashed one in the middle of a segment to bow it.'}
            </p>
            <p className="mt-1.5 text-[0.64rem] leading-relaxed text-slate-moss">
              <span className="font-semibold text-fog">Tip:</span> a segment bows
              toward wherever you drag its dashed handle, and the bow keeps its
              shape as you reshape the route. Make it straight again by dragging
              the handle back onto the line, double-clicking it, or using{' '}
              <span className="text-fog">Straighten</span> for the whole route.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Depth" value={`${depth} yd`} />
              <Metric
                label="Break"
                value={
                  breakDepth === null
                    ? '—'
                    : breakDepth < 0
                      ? 'Behind'
                      : `${breakDepth} yd`
                }
              />
              <Metric label="Points" value={String(points.length)} />
            </div>

            <label className="grid gap-1.5">
              <span className="label">Coaching note</span>
              <textarea
                className="input min-h-28 resize-y leading-relaxed"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Release, landmark, leverage, ball tracking…"
              />
            </label>

            <div
              className="rounded-xl border px-3 py-2.5 text-[0.68rem] leading-relaxed"
              style={{
                borderColor: `${color}55`,
                backgroundColor: `${color}12`,
                color: ROUTE_GROUP_COLORS[group],
              }}
            >
              <span className="font-semibold">{name.trim() || 'Untitled route'}</span>
              <span className="text-slate-moss"> · {group}</span>
              <div className="mt-0.5 text-[0.62rem] text-slate-moss">
                {points.length ? formatRouteBreak(points) : 'No points yet'}
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-[0.74rem] text-coral">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-900 px-2.5 py-2">
      <div className="text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-slate-moss">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[0.74rem] text-chalk">{value}</div>
    </div>
  )
}
