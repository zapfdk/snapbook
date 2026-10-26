import { useEffect, useMemo, useState } from 'react'
import { Check, Palette, RotateCcw, Shield, Sparkles, Users } from 'lucide-react'
import { PlayDiagram } from '../components/PlayDiagram'
import { PLAYER_COLORS } from '../data/defaults'
import { normalizeHex, readableInk } from '../lib/color'
import { cx } from '../lib/files'
import {
  defaultRosterColor,
  getRosterGroups,
  type RosterGroup,
  type RosterGroupPatch,
} from '../lib/roster'
import { selectActivePlaybook, usePlaybook } from '../store/playbook'

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

export function TeamView() {
  const playbook = usePlaybook(selectActivePlaybook)
  const setPlaybookName = usePlaybook((state) => state.setPlaybookName)
  const setTeamName = usePlaybook((state) => state.setTeamName)
  const updateRosterGroup = usePlaybook((state) => state.updateRosterGroup)

  const groups = useMemo(() => getRosterGroups(playbook), [playbook])
  const previewFormation = playbook.formations[0] ?? null
  const previewPlay = playbook.plays[0] ?? null
  const previewPlayers = previewFormation?.players ?? previewPlay?.players ?? []
  const previewLabel = previewFormation?.name ?? previewPlay?.name ?? 'No players yet'

  const resetColors = () => {
    groups.forEach((group, index) => {
      updateRosterGroup(group.role, {
        color: defaultRosterColor(group.role, index),
      })
    })
  }

  return (
    <div className="mx-auto max-w-[1300px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-line bg-ink-850">
        <div className="pointer-events-none absolute inset-0 grid-noise opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-lime/[0.06] blur-3xl" />
        <div className="relative grid gap-7 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="mono-label text-lime/80">Team setup</span>
              <span className="h-px w-8 bg-lime/30" />
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-moss">
                {playbook.level} flag
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.055em] text-chalk sm:text-6xl">
              Your team, your markers.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fog">
              Set each roster role once — the name, marker label, number and color carry
              through every formation, play, diagram and printout.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="chip">
              <Users size={12} className="text-lime" />
              {plural(groups.length, 'roster spot')}
            </span>
            <span className="chip">
              <Shield size={12} className="text-lime" />
              {plural(playbook.formations.length, 'formation')}
            </span>
            <span className="chip">
              <Sparkles size={12} className="text-lime" />
              Saved automatically
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="mono-label text-lime/80">Roster</span>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.03em] text-chalk">
                Player markers
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fog">
                Edit a role here and Snapbook updates every matching player. Alignments
                and routes stay exactly where they are.
              </p>
            </div>
            <button
              className="btn btn-secondary !px-3 !py-2"
              onClick={resetColors}
              disabled={!groups.length}
            >
              <RotateCcw size={14} />
              Reset colors
            </button>
          </div>

          {groups.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <RosterCard
                  key={group.key}
                  group={group}
                  onApply={(patch) => updateRosterGroup(group.role, patch)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-ink-850/60 p-8 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-ink-800 text-fog">
                <Users size={20} />
              </span>
              <p className="mt-3 font-display text-lg font-bold text-chalk">No players yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-fog">
                Create a play with a formation to start building your roster markers.
              </p>
            </div>
          )}
        </section>

        <aside className="grid content-start gap-4">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-lime" />
              <h2 className="font-display text-lg font-bold tracking-tight text-chalk">
                Playbook identity
              </h2>
            </div>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-moss">
              These names appear in the app, on printed pages and in your backups.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="label">Playbook name</span>
                <input
                  className="input"
                  value={playbook.name}
                  maxLength={80}
                  onChange={(event) => setPlaybookName(event.target.value)}
                  onBlur={() => {
                    if (!playbook.name.trim()) setPlaybookName('My flag playbook')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  placeholder="My flag playbook"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="label">Team / squad</span>
                <input
                  className="input"
                  value={playbook.team}
                  maxLength={80}
                  onChange={(event) => setTeamName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[0.68rem] text-slate-moss">
              <Check size={12} className="text-lime" />
              Changes save in this browser automatically.
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-chalk">
                  Formation preview
                </h2>
                <p className="mt-0.5 text-[0.66rem] text-slate-moss">{previewLabel}</p>
              </div>
              <span className="chip shrink-0">
                <Users size={11} />
                {previewPlayers.length}
              </span>
            </div>
            <div className="border-y border-line field-surface">
              <PlayDiagram
                players={previewPlayers}
                className="aspect-square w-full"
                dark
                ariaLabel="Roster marker preview"
              />
            </div>
            <p className="px-4 py-3 text-[0.68rem] leading-relaxed text-slate-moss">
              Labels switch between dark and light ink automatically, so any marker
              color stays readable.
            </p>
          </section>

          <section className="rounded-2xl border border-lime/20 bg-lime/[0.045] p-4">
            <p className="flex items-center gap-2 text-[0.72rem] font-semibold text-lime">
              <Sparkles size={13} />
              Roster changes are global
            </p>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-fog">
              Renaming or recoloring a role updates every formation and play using it.
              Use the designer when you need a one-play label or color override.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function RosterCard({
  group,
  onApply,
}: {
  group: RosterGroup
  onApply: (patch: RosterGroupPatch) => void
}) {
  const [role, setRole] = useState(group.role)
  const [label, setLabel] = useState(group.label)
  const [number, setNumber] = useState(group.number === null ? '' : String(group.number))

  useEffect(() => {
    setRole(group.role)
    setLabel(group.label)
    setNumber(group.number === null ? '' : String(group.number))
  }, [group.role, group.label, group.number])

  const commitRole = () => {
    const next = role.trim()
    if (!next) {
      setRole(group.role)
      return
    }
    if (next !== group.role) onApply({ role: next })
  }

  const commitLabel = () => {
    const next = label.trim().toUpperCase().slice(0, 4)
    if (!next) {
      setLabel(group.label)
      return
    }
    setLabel(next)
    if (next !== group.label) onApply({ label: next })
  }

  const commitNumber = () => {
    const raw = number.trim()
    if (!raw) {
      setNumber('')
      if (group.number !== null) onApply({ number: null })
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setNumber(group.number === null ? '' : String(group.number))
      return
    }
    const next = Math.max(0, Math.min(99, Math.round(parsed)))
    setNumber(String(next))
    if (next !== group.number) onApply({ number: next })
  }

  const markerShape = group.label.toUpperCase() === 'C' ? 'rounded-xl' : 'rounded-full'

  return (
    <article className="rounded-2xl border border-line bg-ink-850 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'grid h-12 w-12 shrink-0 place-items-center text-[0.7rem] font-bold shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)]',
            markerShape,
          )}
          style={{ backgroundColor: group.color, color: readableInk(group.color) }}
          aria-hidden="true"
        >
          {group.label || '?'}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.02rem] font-bold tracking-tight text-chalk">
            {group.role || 'Unnamed player'}
          </h3>
          <p className="mt-0.5 text-[0.64rem] text-slate-moss">
            {plural(group.formationCount, 'formation')} · {plural(group.playCount, 'play')}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="label">Player name</span>
          <input
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onBlur={commitRole}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setRole(group.role)
                event.currentTarget.blur()
              }
            }}
            placeholder="e.g. Center or Alex"
            aria-label={`Player name for ${group.role}`}
          />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <label className="grid gap-1.5">
            <span className="label">Marker label</span>
            <input
              className="input font-mono uppercase"
              value={label}
              maxLength={4}
              onChange={(event) => setLabel(event.target.value.toUpperCase())}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  setLabel(group.label)
                  event.currentTarget.blur()
                }
              }}
              placeholder="WR"
              aria-label={`Marker label for ${group.role}`}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="label">Number</span>
            <input
              className="input font-mono"
              value={number}
              inputMode="numeric"
              onChange={(event) => setNumber(event.target.value)}
              onBlur={commitNumber}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  setNumber(group.number === null ? '' : String(group.number))
                  event.currentTarget.blur()
                }
              }}
              placeholder="—"
              aria-label={`Jersey number for ${group.role}`}
            />
          </label>
        </div>

        <div>
          <span className="label">Marker color</span>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <label
              className="relative grid h-6 w-6 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-white/40"
              style={{ backgroundColor: group.color }}
              title={`Choose a custom color for ${group.role}`}
            >
              <Palette size={11} style={{ color: readableInk(group.color) }} />
              <input
                type="color"
                value={normalizeHex(group.color)}
                onChange={(event) => onApply({ color: event.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`Custom color for ${group.role}`}
              />
            </label>
            {PLAYER_COLORS.map((color) => {
              const active = group.color.toLowerCase() === color.toLowerCase()
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onApply({ color })}
                  className={cx(
                    'grid h-5 w-5 place-items-center rounded-full border-2 transition-transform hover:scale-110',
                    active ? 'border-white' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Set ${group.role} to ${color}`}
                  aria-pressed={active}
                  title={color}
                >
                  {active && <Check size={10} style={{ color: readableInk(color) }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </article>
  )
}
