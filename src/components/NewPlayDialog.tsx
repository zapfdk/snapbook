import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Modal } from './Modal'
import { PlayDiagram } from './PlayDiagram'
import { usePlaybook } from '../store/playbook'
import { cx } from '../lib/files'

interface NewPlayDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (playId: string) => void
}

export function NewPlayDialog({ open, onClose, onCreate }: NewPlayDialogProps) {
  const playbook = usePlaybook((state) => state.playbook)
  const createPlay = usePlaybook((state) => state.createPlay)

  const [name, setName] = useState('')
  const [codeName, setCodeName] = useState('')
  const [formationId, setFormationId] = useState(playbook.formations[0]?.id ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setCodeName('')
    setFormationId(playbook.formations[0]?.id ?? '')
    setCategoryIds([])
    setError('')
  }, [open, playbook.formations])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the play a name.')
      return
    }
    if (playbook.plays.some((play) => play.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A play with that name already exists. PBC exports need unique names.')
      return
    }
    const id = createPlay({ formationId, name: trimmed, codeName, categoryIds })
    onCreate(id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New play"
      description="Start from a formation. You can move everyone after."
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.7rem] text-slate-moss">
            Plays are saved automatically to this browser.
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit}>
              Create play
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <label className="grid gap-2">
            <span className="label">Play name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="e.g. Mesh Right"
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Wrist code</span>
            <input
              className="input font-mono uppercase"
              value={codeName}
              onChange={(event) => setCodeName(event.target.value.toUpperCase())}
              placeholder="MESH"
              maxLength={12}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          </label>
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="label">Formation</span>
            <span className="text-[0.66rem] text-slate-moss">5 players on the field</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {playbook.formations.map((formation) => {
              const active = formation.id === formationId
              return (
                <button
                  key={formation.id}
                  type="button"
                  onClick={() => setFormationId(formation.id)}
                  className={cx(
                    'group relative overflow-hidden rounded-xl border text-left transition-all',
                    active
                      ? 'border-lime/70 bg-lime/[0.05] ring-1 ring-lime/30'
                      : 'border-line bg-ink-900 hover:border-[#3a4c3f]',
                  )}
                >
                  <div className="field-surface p-2">
                    <PlayDiagram
                      players={formation.players}
                      className="aspect-square w-full"
                      dark
                      fieldLines
                      showLabels={false}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line/70 px-2.5 py-2">
                    <span className="truncate text-[0.72rem] font-semibold text-chalk">
                      {formation.name}
                    </span>
                    {active && <Check size={13} className="shrink-0 text-lime" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="label">Tags</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {playbook.categories.map((category) => {
              const active = categoryIds.includes(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryIds(
                      active
                        ? categoryIds.filter((id) => id !== category.id)
                        : [...categoryIds, category.id],
                    )
                  }
                  className={cx(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold transition-colors',
                    active
                      ? 'border-lime/40 bg-lime/10 text-lime'
                      : 'border-line bg-ink-900 text-fog hover:text-chalk',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-[0.76rem] text-coral">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
