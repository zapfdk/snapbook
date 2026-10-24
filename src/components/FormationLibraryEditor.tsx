import { useEffect, useMemo, useState } from 'react'
import { Check, Grip, Layers } from 'lucide-react'
import { FieldCanvas } from './FieldCanvas'
import { Modal } from './Modal'
import { cx } from '../lib/files'
import { createId, type Formation, type Play, type Player } from '../types'

interface FormationLibraryEditorProps {
  open: boolean
  formation: Formation | null
  isNew: boolean
  /** Names that cannot be reused, excluding the formation being edited. */
  existingNames: string[]
  /** Plays that will receive the new alignments when this is saved. */
  affectedPlays: number
  onClose: () => void
  onSave: (formation: Formation) => void
}

export function FormationLibraryEditor({
  open,
  formation,
  isNew,
  existingNames,
  affectedPlays,
  onClose,
  onSave,
}: FormationLibraryEditorProps) {
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(formation?.name ?? '')
    setPlayers(
      (formation?.players ?? []).map((player) => ({
        ...player,
        pos: { ...player.pos },
        route: null,
      })),
    )
    setSelectedId(formation?.players[0]?.id ?? null)
    setError('')
  }, [open, formation])

  const preview = useMemo<Play>(
    () => ({
      id: formation?.id ?? 'formation-preview',
      name: name.trim() || 'Formation under construction',
      codeName: '',
      formationId: formation?.id ?? '',
      players,
      categories: [],
      notes: '',
      createdAt: '',
      updatedAt: '',
    }),
    [formation?.id, name, players],
  )

  const selected = players.find((player) => player.id === selectedId) ?? null

  const movePlayer = (playerId: string, pos: Player['pos']) => {
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, pos } : player)),
    )
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give this formation a name.')
      return
    }
    if (existingNames.some((item) => item.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError('Another formation already uses that name.')
      return
    }
    if (!players.length) {
      setError('This formation has no players.')
      return
    }
    onSave({
      id: formation?.id ?? createId(),
      name: trimmed,
      players: players.map((player) => ({
        ...player,
        route: null,
        pos: { ...player.pos },
      })),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New formation' : 'Edit formation'}
      description="Formations are reusable starting points for future plays."
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.68rem] text-slate-moss">
            {affectedPlays > 0
              ? `Saving also updates ${affectedPlays} play${affectedPlays === 1 ? '' : 's'} using this formation. Their routes stay put.`
              : 'New plays can start from this formation.'}
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              <Check size={14} />
              {isNew ? 'Add formation' : 'Save formation'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] lg:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-2.5 py-2 text-[0.68rem] text-slate-moss">
            <Grip size={13} className="shrink-0 text-lime" />
            Drag any marker to adjust the formation.
          </div>
          <div className="relative aspect-square overflow-hidden rounded-xl border border-line">
            <FieldCanvas
              play={preview}
              selectedId={selectedId}
              tool="move"
              draft={null}
              onSelect={setSelectedId}
              onMovePlayer={movePlayer}
              onAddDraftPoint={() => undefined}
              onSetRoutePoints={() => undefined}
              onSketch={() => undefined}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="label">Formation name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="e.g. Trips Right"
              data-autofocus
            />
          </label>

          <div className="rounded-xl border border-line bg-ink-850 p-3">
            <div className="flex items-center gap-2 text-[0.68rem] font-semibold text-chalk">
              <Layers size={13} className="text-lime" />
              Selected player
            </div>
            {selected ? (
              <div className="mt-2 flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.64rem] font-bold text-ink-950"
                  style={{ backgroundColor: selected.color }}
                >
                  {selected.label}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[0.76rem] font-semibold text-chalk">
                    {selected.role}
                  </div>
                  <div className="mt-0.5 font-mono text-[0.62rem] text-slate-moss">
                    {selected.pos.x.toFixed(1)} wide · {selected.pos.y.toFixed(1)} deep
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-[0.68rem] text-slate-moss">
                Click a marker to inspect its alignment.
              </p>
            )}
            <p className="mt-2.5 text-[0.62rem] leading-relaxed text-slate-moss">
              Names, numbers and colors are managed once in Team setup and stay
              consistent across formations.
            </p>
          </div>

          <div className="grid gap-2">
            <span className="label">Lineup</span>
            <div className="grid grid-cols-2 gap-1.5">
              {players.map((player) => (
                <button
                  key={player.id}
                  className={cx(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[0.66rem] font-semibold transition-colors',
                    player.id === selectedId
                      ? 'border-lime/40 bg-lime/10 text-chalk'
                      : 'border-line bg-ink-900 text-fog hover:text-chalk',
                  )}
                  onClick={() => setSelectedId(player.id)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="truncate">{player.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-[0.74rem] text-coral">
              {error}
            </p>
          )}

          {!isNew && affectedPlays > 0 && (
            <p className="rounded-lg border border-lime/20 bg-lime/[0.05] px-3 py-2 text-[0.66rem] leading-relaxed text-fog">
              This formation is used by {affectedPlays} play
              {affectedPlays === 1 ? '' : 's'}. Saving updates their alignments
              and labels, while every route stays where it is.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
