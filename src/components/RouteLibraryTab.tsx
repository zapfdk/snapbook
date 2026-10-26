import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import { RoutePreview } from './RoutePreview'
import { RouteLibraryEditor } from './RouteLibraryEditor'
import { selectActivePlaybook, usePlaybook } from '../store/playbook'
import {
  ROUTE_GROUPS,
  ROUTE_GROUP_COLORS,
  formatRouteBreak,
  routeBreak,
  routeDepth,
  type RouteGroup,
} from '../data/routeLibrary'
import type { LibraryRoute } from '../types'
import { cx } from '../lib/files'

interface EditorState {
  route: LibraryRoute | null
  isNew: boolean
}

export function RouteLibraryTab() {
  const playbook = usePlaybook(selectActivePlaybook)
  const addRoute = usePlaybook((state) => state.addRoute)
  const updateRoute = usePlaybook((state) => state.updateRoute)
  const deleteRoute = usePlaybook((state) => state.deleteRoute)

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<RouteGroup | null>(null)
  const [preview, setPreview] = useState<LibraryRoute | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryRoute | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim()
    return playbook.routes.filter((route) => {
      const matchesGroup = !group || route.group === group
      const matchesQuery =
        !term ||
        route.name.toLowerCase().includes(term) ||
        route.group.toLowerCase().includes(term) ||
        route.note.toLowerCase().includes(term)
      return matchesGroup && matchesQuery
    })
  }, [playbook.routes, query, group])

  const editingNames = editor
    ? playbook.routes
        .filter((route) => route.id !== editor.route?.id)
        .map((route) => route.name)
    : []

  const saveRoute = (route: LibraryRoute) => {
    if (!editor) return
    if (editor.isNew) addRoute(route)
    else updateRoute(route.id, route)
    setEditor(null)
    if (preview?.id === route.id) setPreview(null)
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={!group} onClick={() => setGroup(null)}>
            All routes
            <span className="ml-1 text-slate-moss">{playbook.routes.length}</span>
          </FilterChip>
          {ROUTE_GROUPS.map((item) => (
            <FilterChip
              key={item}
              active={group === item}
              onClick={() => setGroup(group === item ? null : item)}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ROUTE_GROUP_COLORS[item] }}
              />
              {item}
              <span className="ml-1 text-slate-moss">
                {playbook.routes.filter((route) => route.group === item).length}
              </span>
            </FilterChip>
          ))}

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-moss"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search routes and coaching notes"
                className="input pl-9 pr-8"
                aria-label="Search routes"
              />
              {query && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-moss hover:text-chalk"
                  onClick={() => setQuery('')}
                  aria-label="Clear route search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className="btn btn-primary shrink-0"
              onClick={() => setEditor({ route: null, isNew: true })}
            >
              <Plus size={15} />
              New route
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-800 text-fog">
            <Search size={22} />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-chalk">
            {playbook.routes.length ? 'No routes match that search' : 'Build your route library'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-fog">
            {playbook.routes.length
              ? 'Try another route name or clear the group filter.'
              : 'Add a reusable route once, then apply it to any receiver in the designer.'}
          </p>
          <button
            className="btn btn-primary mt-5"
            onClick={() => setEditor({ route: null, isNew: true })}
          >
            <Plus size={15} />
            New route
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((route) => {
            const depth = routeDepth(route.points)
            return (
              <article
                key={route.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-ink-850 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b4e40] hover:shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
                onClick={() => setPreview(route)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setPreview(route)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Preview ${route.name} route`}
              >
                <div className="relative aspect-[5/4] overflow-hidden field-surface">
                  <RoutePreview
                    points={route.points}
                    color={route.color}
                    className="absolute inset-0 h-full w-full"
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-ink-950/70 px-2 py-1 text-[0.6rem] font-semibold text-chalk backdrop-blur">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: route.color }}
                      />
                      {route.group}
                    </span>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/75 text-chalk backdrop-blur hover:bg-ink-800"
                      onClick={(event) => {
                        event.stopPropagation()
                        setEditor({ route, isNew: false })
                      }}
                      aria-label={`Edit ${route.name}`}
                      title="Edit route"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/75 text-chalk backdrop-blur hover:bg-coral/20 hover:text-coral"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(route)
                      }}
                      aria-label={`Delete ${route.name}`}
                      title="Delete route"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-white/10 bg-ink-950/80 px-2.5 py-1 text-[0.62rem] font-semibold text-chalk opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    Preview route
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                      {route.name}
                    </h3>
                    <ArrowUpRight
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-moss transition-colors group-hover:text-lime"
                    />
                  </div>
                  <p className="mt-1.5 line-clamp-2 min-h-[2.2rem] text-[0.72rem] leading-relaxed text-slate-moss">
                    {route.note || 'No coaching note yet.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                    <span className="text-[0.62rem] text-slate-moss">
                      {formatRouteBreak(route.points)} · {depth} yd
                    </span>
                    <span
                      className="h-1.5 w-8 rounded-full"
                      style={{ backgroundColor: route.color }}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <RoutePreviewModal
        route={preview}
        onClose={() => setPreview(null)}
        onEdit={(route) => {
          setPreview(null)
          setEditor({ route, isNew: false })
        }}
      />

      <RouteLibraryEditor
        open={Boolean(editor)}
        route={editor?.route ?? null}
        isNew={editor?.isNew ?? true}
        existingNames={editingNames}
        onClose={() => setEditor(null)}
        onSave={saveRoute}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this route?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the route library.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
              Keep route
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleteTarget) deleteRoute(deleteTarget.id)
                setDeleteTarget(null)
                setPreview(null)
              }}
            >
              <Trash2 size={14} />
              Delete route
            </button>
          </div>
        }
      >
        <p className="text-sm text-fog">
          Plays that already use these route points keep them. Only future
          applications from the library change.
        </p>
      </Modal>
    </>
  )
}

function RoutePreviewModal({
  route,
  onClose,
  onEdit,
}: {
  route: LibraryRoute | null
  onClose: () => void
  onEdit: (route: LibraryRoute) => void
}) {
  if (!route) return null
  const depth = routeDepth(route.points)
  const breakDepth = routeBreak(route.points)

  return (
    <Modal
      open
      onClose={onClose}
      title={route.name}
      description={`${route.group} · ${depth} yd deep`}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.68rem] text-slate-moss">
            Apply this route to any receiver in the Designer.
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={() => onEdit(route)}>
              <Pencil size={14} />
              Edit route
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1.1fr_1fr] sm:items-center">
        <div className="overflow-hidden rounded-xl border border-line field-surface">
          <RoutePreview points={route.points} color={route.color} className="aspect-[5/4] w-full" />
        </div>
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold"
            style={{
              borderColor: `${route.color}55`,
              color: route.color,
              backgroundColor: `${route.color}12`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: route.color }}
            />
            {route.group}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-fog">
            {route.note || 'No coaching note for this route yet.'}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="Depth" value={`${depth} yd`} />
            <Metric
              label="Break"
              value={breakDepth === null ? '—' : breakDepth < 0 ? 'Behind LOS' : `${breakDepth} yd`}
            />
            <Metric label="Points" value={String(route.points.length)} />
          </div>
          <p className="mt-4 text-[0.68rem] leading-relaxed text-slate-moss">
            Every route starts from the same receiver alignment, so depth and
            leverage are easy to compare.
          </p>
        </div>
      </div>
    </Modal>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-900 px-3 py-2">
      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-moss">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[0.78rem] text-chalk">{value}</div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold transition-colors',
        active
          ? 'border-lime/40 bg-lime/10 text-lime'
          : 'border-line bg-ink-900 text-fog hover:border-[#34453a] hover:text-chalk',
      )}
    >
      {children}
    </button>
  )
}
