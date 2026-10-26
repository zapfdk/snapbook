import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Download,
  GitFork,
  GitMerge,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  PencilLine,
  Replace,
  Users,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { Modal } from '../components/Modal'
import { PlayDiagram } from '../components/PlayDiagram'
import { RoutePreview } from '../components/RoutePreview'
import { SiteFooter } from '../components/SiteFooter'
import { formatRouteBreak, routeDepth } from '../data/routeLibrary'
import { cx, exportNative, formatDate } from '../lib/files'
import { getRosterGroups } from '../lib/roster'
import type { Playbook } from '../types'

interface SharedPlaybookViewProps {
  playbook: Playbook
  /** The playbook currently saved in this browser, if the visitor has one. */
  localPlaybook: Playbook
  onEdit: () => void
  onMerge: () => void
  onExit: () => void
}

export function SharedPlaybookView({
  playbook,
  localPlaybook,
  onEdit,
  onMerge,
  onExit,
}: SharedPlaybookViewProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [backupDownloaded, setBackupDownloaded] = useState(false)
  const replacesLocal = localPlaybook.plays.length > 0

  const closeEditDialog = () => {
    setEditOpen(false)
    setMode('merge')
    setBackupDownloaded(false)
  }

  const formations = new Map(
    playbook.formations.map((formation) => [formation.id, formation.name]),
  )
  const roster = getRosterGroups(playbook)

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-line bg-ink-900 px-3 py-1.5 sm:flex">
            <Lock size={11} className="text-lime" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fog">
              Read-only share
            </span>
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              className="btn btn-ghost !px-2 sm:!px-3"
              onClick={onExit}
              aria-label="Open my playbook"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Open my playbook</span>
            </button>
            <button className="btn btn-primary !px-2.5 sm:!px-4" onClick={() => setEditOpen(true)}>
              <PencilLine size={15} />
              Edit a copy
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[1.6rem] border border-line bg-ink-850">
          <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
          <div className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-lime/[0.06] blur-3xl" />
          <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="mono-label text-lime/80">Shared playbook</span>
                <span className="h-px w-8 bg-lime/30" />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-moss">
                  {playbook.level} flag
                </span>
              </div>
              <h1 className="mt-4 font-display text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.055em] text-chalk sm:text-6xl">
                {playbook.name}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-fog">
                {playbook.team ? `${playbook.team} · ` : ''}
                You’re viewing a shared copy. Browse everything below, then merge it
                into your playbook or edit a copy of your own.
              </p>
              {playbook.categories.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {playbook.categories.map((category) => (
                    <span key={category.id} className="chip">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-3">
              <Stat value={playbook.plays.length} label="Plays" />
              <Stat value={playbook.formations.length} label="Formations" />
              <Stat value={playbook.categories.length} label="Tags" />
              <Stat value={playbook.routes.length} label="Routes" />
            </div>
          </div>
        </section>

        <Section
          icon={<LayoutGrid size={15} />}
          title="Plays"
          count={playbook.plays.length}
          description="Every play with its formation, tags, coaching notes and diagram."
        >
          {playbook.plays.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {playbook.plays.map((play) => {
                const tags = playbook.categories.filter((category) =>
                  play.categories.includes(category.id),
                )
                return (
                  <article
                    key={play.id}
                    className="overflow-hidden rounded-2xl border border-line bg-ink-850"
                  >
                    <div className="relative aspect-square overflow-hidden field-surface">
                      <PlayDiagram
                        players={play.players}
                        className="absolute inset-0 h-full w-full"
                        dark
                        ariaLabel={`${play.name} diagram`}
                      />
                      {play.codeName && (
                        <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-ink-950/70 px-1.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] text-lime backdrop-blur">
                          {play.codeName}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                          {play.name}
                        </h3>
                        <span className="flex shrink-0 items-center gap-1 text-[0.62rem] text-slate-moss">
                          <CalendarDays size={11} />
                          {formatDate(play.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[0.72rem] text-slate-moss">
                        {formations.get(play.formationId) ?? 'Custom formation'} ·{' '}
                        {play.players.filter((player) => player.route).length} routed
                      </p>
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tags.map((category) => (
                            <span key={category.id} className="chip !py-1 !text-[0.6rem]">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 whitespace-pre-line border-t border-line/70 pt-3 text-[0.72rem] leading-relaxed text-fog">
                        {play.notes.trim() || 'No coaching notes for this play.'}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState text="This shared playbook has no plays yet." />
          )}
        </Section>

        <Section
          icon={<GitFork size={15} />}
          title="Route library"
          count={playbook.routes.length}
          description="The reusable routes this playbook draws from, with coaching notes."
        >
          {playbook.routes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {playbook.routes.map((route) => (
                <article
                  key={route.id}
                  className="overflow-hidden rounded-2xl border border-line bg-ink-850"
                >
                  <div className="relative aspect-[5/4] overflow-hidden field-surface">
                    <RoutePreview
                      points={route.points}
                      color={route.color}
                      className="absolute inset-0 h-full w-full"
                    />
                    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md border border-white/10 bg-ink-950/70 px-2 py-1 text-[0.6rem] font-semibold text-chalk backdrop-blur">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: route.color }}
                      />
                      {route.group}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                      {route.name}
                    </h3>
                    <p className="mt-1.5 text-[0.72rem] leading-relaxed text-fog">
                      {route.note.trim() || 'No coaching note for this route.'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5 text-[0.62rem] text-slate-moss">
                      <span>
                        {formatRouteBreak(route.points)} · {routeDepth(route.points)} yd
                      </span>
                      <span
                        className="h-1.5 w-8 rounded-full"
                        style={{ backgroundColor: route.color }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="This shared playbook has no route library." />
          )}
        </Section>

        <Section
          icon={<Layers size={15} />}
          title="Formations"
          count={playbook.formations.length}
          description="The starting alignments every play is built from."
        >
          {playbook.formations.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {playbook.formations.map((formation) => {
                const usage = playbook.plays.filter(
                  (play) => play.formationId === formation.id,
                ).length
                return (
                  <article
                    key={formation.id}
                    className="overflow-hidden rounded-2xl border border-line bg-ink-850"
                  >
                    <div className="relative aspect-[5/4] overflow-hidden field-surface">
                      <PlayDiagram
                        players={formation.players}
                        className="absolute inset-0 h-full w-full"
                        dark
                        ariaLabel={`${formation.name} formation`}
                      />
                      <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-ink-950/70 px-2 py-1 text-[0.6rem] font-semibold text-chalk backdrop-blur">
                        {formation.players.length} players
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="truncate font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                        {formation.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {formation.players.map((player) => (
                          <span
                            key={player.id}
                            className="chip !py-1 !text-[0.6rem]"
                            title={`${player.role}${
                              player.number === null ? '' : ` · #${player.number}`
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: player.color }}
                            />
                            {player.label || player.role}
                            {player.number === null ? '' : ` · ${player.number}`}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 border-t border-line/70 pt-2.5 text-[0.62rem] text-slate-moss">
                        {usage ? `Used by ${usage} play${usage === 1 ? '' : 's'}` : 'Not used yet'}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <EmptyState text="This shared playbook has no formations." />
          )}
        </Section>

        <Section
          icon={<Users size={15} />}
          title="Team"
          count={roster.length}
          description="The playbook identity and the players behind its markers."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {roster.map((group) => (
                <article
                  key={group.key}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-ink-850 p-4"
                >
                  <span
                    className={
                      group.label.toUpperCase() === 'C'
                        ? 'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[0.68rem] font-bold'
                        : 'grid h-11 w-11 shrink-0 place-items-center rounded-full text-[0.68rem] font-bold'
                    }
                    style={{ backgroundColor: group.color }}
                    aria-hidden="true"
                  >
                    {group.label || '?'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-[0.98rem] font-bold tracking-tight text-chalk">
                      {group.role || 'Unnamed player'}
                    </h3>
                    <p className="mt-0.5 text-[0.66rem] text-slate-moss">
                      {group.number === null ? 'No number' : `#${group.number}`} ·{' '}
                      {group.formationCount} formation
                      {group.formationCount === 1 ? '' : 's'} · {group.playCount} play
                      {group.playCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </article>
              ))}
              {!roster.length && <EmptyState text="No players in this playbook yet." />}
            </div>

            <aside className="rounded-2xl border border-line bg-ink-850 p-5">
              <div className="flex items-center gap-2">
                <PencilLine size={14} className="text-lime" />
                <h3 className="font-display text-lg font-bold tracking-tight text-chalk">
                  Build on this playbook
                </h3>
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-fog">
                Merge it into your playbook or start fresh from this copy, then keep
                editing in your browser.
              </p>
              <button className="btn btn-primary mt-4 w-full" onClick={() => setEditOpen(true)}>
                <PencilLine size={14} />
                Edit a copy
              </button>
              <dl className="mt-4 grid gap-3 border-t border-line/70 pt-4">
                <IdentityRow label="Playbook" value={playbook.name} />
                <IdentityRow label="Team / squad" value={playbook.team || '—'} />
                <IdentityRow label="Field size" value={`${playbook.level} flag`} />
                <IdentityRow label="Tags" value={String(playbook.categories.length)} />
              </dl>
              <p className="mt-4 flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-slate-moss">
                <Link2 size={12} className="mt-0.5 shrink-0 text-lime" />
                The playbook travels inside this link. Browsing it never replaces the
                playbook saved in your browser.
              </p>
            </aside>
          </div>
        </Section>

        <SiteFooter className="mt-10" note="Shared from Snapbook · read-only view" />
      </main>

      <Modal
        open={editOpen}
        onClose={closeEditDialog}
        title="Edit this shared playbook"
        description="Merge it into your playbook, or start fresh from the shared copy."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.66rem] text-slate-moss">
              Nothing changes until you confirm.
            </span>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={closeEditDialog}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeEditDialog()
                  if (mode === 'merge') onMerge()
                  else onEdit()
                }}
              >
                {mode === 'merge' ? <GitMerge size={14} /> : <PencilLine size={14} />}
                {mode === 'merge'
                  ? 'Merge into my playbook'
                  : replacesLocal
                    ? 'Replace and edit'
                    : 'Use and edit'}
              </button>
            </div>
          </div>
        }
      >
        <div className="rounded-xl border border-lime/25 bg-lime/[0.06] p-4">
          <div className="mono-label text-lime/80">Shared playbook</div>
          <p className="mt-1 font-display text-lg font-bold tracking-tight text-chalk">
            {playbook.name}
          </p>
          <p className="mt-1 text-[0.72rem] text-fog">
            {playbook.plays.length} play{playbook.plays.length === 1 ? '' : 's'} ·{' '}
            {playbook.formations.length} formation
            {playbook.formations.length === 1 ? '' : 's'} · {playbook.routes.length} route
            {playbook.routes.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === 'merge'}
            onClick={() => setMode('merge')}
            className={cx(
              'rounded-xl border p-4 text-left transition-colors',
              mode === 'merge'
                ? 'border-lime/45 bg-lime/[0.08]'
                : 'border-line bg-ink-900 hover:bg-ink-800',
            )}
          >
            <span className="flex items-center gap-2 text-[0.78rem] font-semibold text-chalk">
              <GitMerge size={15} className="text-lime" />
              Merge into mine
            </span>
            <span className="mt-1.5 block text-[0.7rem] leading-relaxed text-fog">
              Adds the shared plays, formations, routes and tags to
              “{localPlaybook.name}”, skipping exact duplicates. Your existing
              plays stay.
            </span>
          </button>

          <button
            type="button"
            aria-pressed={mode === 'replace'}
            onClick={() => setMode('replace')}
            className={cx(
              'rounded-xl border p-4 text-left transition-colors',
              mode === 'replace'
                ? 'border-coral/45 bg-coral/[0.07]'
                : 'border-line bg-ink-900 hover:bg-ink-800',
            )}
          >
            <span className="flex items-center gap-2 text-[0.78rem] font-semibold text-chalk">
              <Replace size={15} className="text-coral" />
              {replacesLocal ? 'Replace mine' : 'Use as my playbook'}
            </span>
            <span className="mt-1.5 block text-[0.7rem] leading-relaxed text-fog">
              Starts fresh from the shared copy
              {replacesLocal
                ? ` and replaces “${localPlaybook.name}” in this browser.`
                : '.'}
            </span>
          </button>
        </div>

        {mode === 'replace' && replacesLocal && (
          <div className="mt-3 rounded-xl border border-coral/25 bg-coral/[0.07] p-4">
            <div className="flex items-center gap-2 text-[0.72rem] font-semibold text-coral">
              <AlertTriangle size={14} />
              This replaces your current playbook
            </div>
            <p className="mt-1.5 text-[0.72rem] leading-relaxed text-fog">
              “{localPlaybook.name}” and its {localPlaybook.plays.length} play
              {localPlaybook.plays.length === 1 ? '' : 's'} are only saved in this browser.
              Download a backup first if you want to keep them.
            </p>
            <button
              className="btn btn-secondary mt-3"
              onClick={() => {
                exportNative(localPlaybook)
                setBackupDownloaded(true)
              }}
            >
              <Download size={14} />
              {backupDownloaded ? 'Backup downloaded' : 'Download a backup first'}
            </button>
          </div>
        )}

        {mode === 'merge' && replacesLocal && (
          <p className="mt-3 rounded-xl border border-lime/20 bg-lime/[0.05] px-4 py-3 text-[0.7rem] leading-relaxed text-fog">
            Merging keeps every play in “{localPlaybook.name}”. Exact duplicate
            plays are skipped; formations, routes and tags are only added when they
            are new or different.
          </p>
        )}
      </Modal>
    </div>
  )
}

function Section({
  icon,
  title,
  count,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="mono-label flex items-center gap-1.5 text-lime/80">
            {icon}
            {title}
          </span>
          <p className="mt-1 text-sm text-fog">{description}</p>
        </div>
        <span className="chip">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-fog">
      {text}
    </div>
  )
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-slate-moss">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[0.78rem] font-semibold text-chalk">{value}</dd>
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
