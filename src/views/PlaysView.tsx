import { useMemo, useRef, useState, useEffect } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  Copy,
  Eye,
  FilePenLine,
  FilePlus2,
  GitFork,
  Layers,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { usePlaybook } from '../store/playbook'
import { PlayDiagram } from '../components/PlayDiagram'
import { LogoBadge } from '../components/Logo'
import { Modal } from '../components/Modal'
import { RouteLibraryTab } from '../components/RouteLibraryTab'
import { FormationLibraryTab } from '../components/FormationLibraryTab'
import { cx, formatDate } from '../lib/files'
import type { Play } from '../types'

interface PlaysViewProps {
  onOpenPlay: (playId: string) => void
  onNewPlay: () => void
  onNewPlaybook: () => void
  onConfigure: () => void
}

export function PlaysView({
  onOpenPlay,
  onNewPlay,
  onNewPlaybook,
  onConfigure,
}: PlaysViewProps) {
  const playbook = usePlaybook((state) => state.playbook)
  const duplicatePlay = usePlaybook((state) => state.duplicatePlay)
  const deletePlay = usePlaybook((state) => state.deletePlay)

  const [mode, setMode] = useState<'plays' | 'routes' | 'formations'>('plays')
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Play | null>(null)
  const [previewPlay, setPreviewPlay] = useState<Play | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMode('plays')
    setQuery('')
    setActiveCategory(null)
  }, [playbook.id])

  useEffect(() => {
    if (mode !== 'plays') return
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const formations = useMemo(
    () => new Map(playbook.formations.map((formation) => [formation.id, formation.name])),
    [playbook.formations],
  )

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim()
    return [...playbook.plays]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter((play) => {
        const matchesCategory =
          !activeCategory || play.categories.includes(activeCategory)
        const matchesQuery =
          !term ||
          play.name.toLowerCase().includes(term) ||
          play.codeName.toLowerCase().includes(term) ||
          (formations.get(play.formationId) ?? '').toLowerCase().includes(term)
        return matchesCategory && matchesQuery
      })
  }, [playbook.plays, query, activeCategory, formations])

  const categories = playbook.categories.filter((category) =>
    playbook.plays.some((play) => play.categories.includes(category.id)),
  )

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-line bg-ink-850">
        <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-lime/[0.06] blur-3xl" />
        <svg
          className="pointer-events-none absolute -right-8 bottom-0 h-[22rem] w-[22rem] text-lime opacity-[0.13] sm:right-10"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <path d="M-4 84h108M-4 63h108M-4 42h108" stroke="currentColor" strokeWidth="0.7" />
          <path d="M12 80c14 0 18-33 36-33 14 0 15 18 34 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="m78 61 12 4-9 8Z" fill="currentColor" />
          <circle cx="12" cy="80" r="4.2" fill="currentColor" />
        </svg>

        <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono-label text-lime/80">Your playbook</span>
              <span className="h-px w-8 bg-lime/30" />
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-moss">
                {playbook.level} flag
              </span>
              <span
                className="ml-auto"
                title="Changes are saved automatically in this browser"
              >
                <LogoBadge />
              </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <h1 className="min-w-0 font-display text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.055em] text-chalk sm:text-6xl">
                {playbook.name}
              </h1>
              <button
                className="icon-btn mb-1.5"
                onClick={onConfigure}
                aria-label="Open team setup"
                title="Open team setup"
              >
                <Settings2 size={17} />
              </button>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-fog">
              {playbook.team ? `${playbook.team} · ` : ''}
              Design your 5v5 menu, keep every formation in one place, then print
              wrist-coach cards that fit your actual insert.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button className="btn btn-primary" onClick={onNewPlay}>
                <Plus size={16} />
                New play
              </button>
              <button className="btn btn-secondary" onClick={onNewPlaybook}>
                <FilePlus2 size={15} />
                New playbook
              </button>
              <span className="hidden text-[0.72rem] text-slate-moss sm:inline">
                or press <kbd className="rounded border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[0.62rem] text-fog">N</kbd>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-3">
            <Stat value={playbook.plays.length} label="Plays" />
            <Stat value={playbook.formations.length} label="Formations" />
            <Stat value={playbook.categories.length} label="Tags" />
            <Stat value={playbook.routes.length} label="Routes" />
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-ink-900 p-1"
          role="tablist"
          aria-label="Browse playbook content"
        >
          <ModeTab
            active={mode === 'plays'}
            onClick={() => setMode('plays')}
            icon={<LayoutGrid size={14} />}
            label="Plays"
            count={playbook.plays.length}
          />
          <ModeTab
            active={mode === 'routes'}
            onClick={() => setMode('routes')}
            icon={<GitFork size={14} />}
            label="Route library"
            count={playbook.routes.length}
          />
          <ModeTab
            active={mode === 'formations'}
            onClick={() => setMode('formations')}
            icon={<Layers size={14} />}
            label="Formations"
            count={playbook.formations.length}
          />
        </div>
        <p className="hidden text-[0.7rem] text-slate-moss sm:block">
          {mode === 'plays'
            ? 'Open a card to edit it. Hover for quick actions.'
            : mode === 'routes'
              ? 'Open any route for a full-size diagram, or edit the library.'
              : 'Open a formation to realign it, or add a new starting lineup.'}
        </p>
      </div>

      {mode === 'plays' ? (
        <>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <FilterChip active={!activeCategory} onClick={() => setActiveCategory(null)}>
            All plays <span className="ml-1 text-slate-moss">{playbook.plays.length}</span>
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              active={activeCategory === category.id}
              onClick={() =>
                setActiveCategory(activeCategory === category.id ? null : category.id)
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-moss"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plays, codes, formations"
            className="input pl-9 pr-8"
            aria-label="Search plays"
          />
          {query && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-moss hover:text-chalk"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-800 text-fog">
            <FilePenLine size={22} />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-chalk">
            {query || activeCategory ? 'No plays match that filter' : 'Start with your first play'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-fog">
            {query || activeCategory
              ? 'Try a different search or clear the tag filter.'
              : 'Pick a formation, place your five players and draw the routes.'}
          </p>
          <button className="btn btn-primary mt-5" onClick={onNewPlay}>
            <Plus size={15} />
            New play
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((play) => {
            const formationName = formations.get(play.formationId) ?? 'Custom'
            const playCategories = playbook.categories.filter((category) =>
              play.categories.includes(category.id),
            )
            return (
              <article
                key={play.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-ink-850 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b4e40] hover:shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
                onClick={() => onOpenPlay(play.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenPlay(play.id)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open ${play.name}`}
              >
                <div className="relative aspect-square overflow-hidden field-surface">
                  <PlayDiagram
                    players={play.players}
                    className="absolute inset-0 h-full w-full"
                    dark
                    ariaLabel={`${play.name} diagram`}
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    {play.codeName && (
                      <span className="rounded-md border border-white/10 bg-ink-950/70 px-1.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] text-lime backdrop-blur">
                        {play.codeName}
                      </span>
                    )}
                  </div>
                  <div className="absolute right-3 top-3 flex gap-1 transition-all md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/70 text-chalk backdrop-blur hover:bg-ink-800"
                      onClick={(event) => {
                        event.stopPropagation()
                        setPreviewPlay(play)
                      }}
                      aria-label={`Preview ${play.name}`}
                      title="Quick preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/70 text-chalk backdrop-blur hover:bg-ink-800"
                      onClick={(event) => {
                        event.stopPropagation()
                        duplicatePlay(play.id)
                      }}
                      aria-label={`Duplicate ${play.name}`}
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/70 text-chalk backdrop-blur hover:bg-coral/20 hover:text-coral"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(play)
                      }}
                      aria-label={`Delete ${play.name}`}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                        {play.name}
                      </h3>
                      <p className="mt-1 text-[0.72rem] text-slate-moss">{formationName}</p>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="mt-1 shrink-0 text-slate-moss transition-colors group-hover:text-lime"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      {playCategories.length ? (
                        playCategories.slice(0, 2).map((category) => (
                          <span key={category.id} className="chip !py-1 !text-[0.6rem]">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="truncate">{category.name}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[0.65rem] text-slate-moss">No tags</span>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[0.62rem] text-slate-moss">
                      <CalendarDays size={11} />
                      {formatDate(play.updatedAt)}
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
        </>
      ) : mode === 'routes' ? (
        <RouteLibraryTab />
      ) : (
        <FormationLibraryTab />
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this play?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the playbook and wrist coach.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
              Keep play
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleteTarget) deletePlay(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              <Trash2 size={14} />
              Delete play
            </button>
          </div>
        }
      >
        <p className="text-sm text-fog">This can’t be undone from inside the app.</p>
      </Modal>

      <Modal
        open={Boolean(previewPlay)}
        onClose={() => setPreviewPlay(null)}
        title={previewPlay?.name ?? 'Play preview'}
        description={
          previewPlay
            ? `${formations.get(previewPlay.formationId) ?? 'Custom formation'}${
                previewPlay.codeName ? ` · ${previewPlay.codeName}` : ''
              }`
            : undefined
        }
        wide
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.68rem] text-slate-moss">
              {previewPlay
                ? `${previewPlay.players.filter((player) => player.route).length} routed players · updated ${formatDate(previewPlay.updatedAt)}`
                : ''}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setPreviewPlay(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!previewPlay) return
                  onOpenPlay(previewPlay.id)
                  setPreviewPlay(null)
                }}
              >
                Open in designer
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        }
      >
        {previewPlay && (
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div className="overflow-hidden rounded-xl border border-line field-surface">
              <PlayDiagram
                players={previewPlay.players}
                className="aspect-square w-full"
                dark
                ariaLabel={`${previewPlay.name} enlarged diagram`}
              />
            </div>
            <div>
              <div className="flex flex-wrap gap-1.5">
                {previewPlay.codeName && (
                  <span className="rounded-md border border-lime/25 bg-lime/10 px-2 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-[0.08em] text-lime">
                    {previewPlay.codeName}
                  </span>
                )}
                {playbook.categories
                  .filter((category) => previewPlay.categories.includes(category.id))
                  .map((category) => (
                    <span key={category.id} className="chip">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                  ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-fog">
                {previewPlay.notes.trim() || 'No coaching notes for this play yet.'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <PreviewMetric
                  label="Formation"
                  value={formations.get(previewPlay.formationId) ?? 'Custom'}
                />
                <PreviewMetric label="Routes" value={String(previewPlay.players.filter((player) => player.route).length)} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.74rem] font-semibold transition-colors sm:px-3',
        active ? 'bg-ink-750 text-chalk shadow-sm' : 'text-slate-moss hover:text-chalk',
      )}
    >
      {icon}
      {label}
      <span
        className={cx(
          'hidden rounded-md px-1.5 py-0.5 font-mono text-[0.58rem] sm:inline',
          active ? 'bg-lime/15 text-lime' : 'bg-ink-850 text-slate-moss',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-900 px-3 py-2">
      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-moss">
        {label}
      </div>
      <div className="mt-0.5 truncate text-[0.76rem] font-semibold text-chalk">{value}</div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[3.9rem] rounded-xl border border-line bg-ink-900/70 px-2 py-2.5 backdrop-blur sm:min-w-[5.8rem] sm:px-4 sm:py-3">
      <div className="font-display text-xl font-bold tracking-tight text-chalk sm:text-2xl">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-slate-moss sm:text-[0.62rem]">
        {label}
      </div>
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

