import {
  ArrowLeft,
  CalendarDays,
  GitFork,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Users,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { PlayDiagram } from '../components/PlayDiagram'
import { RoutePreview } from '../components/RoutePreview'
import { formatRouteBreak, routeDepth } from '../data/routeLibrary'
import { formatDate } from '../lib/files'
import { getRosterGroups } from '../lib/roster'
import type { Playbook } from '../types'

interface SharedPlaybookViewProps {
  playbook: Playbook
  onExit: () => void
}

export function SharedPlaybookView({ playbook, onExit }: SharedPlaybookViewProps) {
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
          <button className="btn btn-secondary ml-auto" onClick={onExit}>
            <ArrowLeft size={15} />
            Open my playbook
          </button>
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
                You’re viewing a shared copy. Everything is read-only and nothing
                here changes the playbook saved in your browser.
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
                <Lock size={14} className="text-lime" />
                <h3 className="font-display text-lg font-bold tracking-tight text-chalk">
                  Shared as read-only
                </h3>
              </div>
              <dl className="mt-4 grid gap-3">
                <IdentityRow label="Playbook" value={playbook.name} />
                <IdentityRow label="Team / squad" value={playbook.team || '—'} />
                <IdentityRow label="Field size" value={`${playbook.level} flag`} />
                <IdentityRow label="Tags" value={String(playbook.categories.length)} />
              </dl>
              <p className="mt-4 flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-slate-moss">
                <Link2 size={12} className="mt-0.5 shrink-0 text-lime" />
                The playbook travels inside this link. Opening it never replaces the
                playbook saved in your browser.
              </p>
            </aside>
          </div>
        </Section>

        <footer className="mt-10 border-t border-line/70 pt-5 text-[0.68rem] text-slate-moss">
          Shared from Snapbook · read-only view
        </footer>
      </main>
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
