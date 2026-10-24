import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import { PlayDiagram } from './PlayDiagram'
import { FormationLibraryEditor } from './FormationLibraryEditor'
import { usePlaybook } from '../store/playbook'
import { createFormationPlayers } from '../data/defaults'
import { cloneFormationPlayers, formationUsage, uniqueFormationName } from '../lib/formations'
import { createId, type Formation } from '../types'

interface EditorState {
  formation: Formation
  isNew: boolean
}

export function FormationLibraryTab() {
  const playbook = usePlaybook((state) => state.playbook)
  const addFormation = usePlaybook((state) => state.addFormation)
  const updateFormation = usePlaybook((state) => state.updateFormation)
  const deleteFormation = usePlaybook((state) => state.deleteFormation)

  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Formation | null>(null)

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim()
    if (!term) return playbook.formations
    return playbook.formations.filter(
      (formation) =>
        formation.name.toLowerCase().includes(term) ||
        formation.players.some(
          (player) =>
            player.label.toLowerCase().includes(term) ||
            player.role.toLowerCase().includes(term),
        ),
    )
  }, [playbook.formations, query])

  const openNew = () => {
    const source = playbook.formations[0]
    setEditor({
      isNew: true,
      formation: {
        id: createId(),
        name: uniqueFormationName(
          'New formation',
          playbook.formations.map((formation) => formation.name),
        ),
        players: source ? cloneFormationPlayers(source.players) : createFormationPlayers(),
      },
    })
  }

  const editingNames = editor
    ? playbook.formations
        .filter((formation) => formation.id !== editor.formation.id)
        .map((formation) => formation.name)
    : []

  const saveFormation = (formation: Formation) => {
    if (!editor) return
    if (editor.isNew) addFormation(formation)
    else updateFormation(formation.id, { name: formation.name, players: formation.players })
    setEditor(null)
  }

  const targetUsage = deleteTarget ? formationUsage(playbook, deleteTarget.id) : 0
  const isLastFormation = playbook.formations.length <= 1
  const deleteBlocked = targetUsage > 0 || isLastFormation

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.72rem] leading-relaxed text-slate-moss">
          Formations are the starting alignments for new plays. Editing one here
          also re-aligns the plays already built from it without touching their
          routes.
        </p>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-moss"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search formations"
              className="input pl-9 pr-8"
              aria-label="Search formations"
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-moss hover:text-chalk"
                onClick={() => setQuery('')}
                aria-label="Clear formation search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button className="btn btn-primary shrink-0" onClick={openNew}>
            <Plus size={15} />
            New formation
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-20 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-800 text-fog">
            <Search size={22} />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-chalk">
            {playbook.formations.length ? 'No formations match that search' : 'Build your first formation'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-fog">
            {playbook.formations.length
              ? 'Try another formation or player name.'
              : 'Set five alignments once, then start every new play from them.'}
          </p>
          <button className="btn btn-primary mt-5" onClick={openNew}>
            <Plus size={15} />
            New formation
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((formation) => {
            const usage = formationUsage(playbook, formation.id)
            return (
              <article
                key={formation.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-ink-850 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b4e40] hover:shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
                onClick={() => setEditor({ formation, isNew: false })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setEditor({ formation, isNew: false })
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Edit ${formation.name} formation`}
              >
                <div className="relative aspect-[5/4] overflow-hidden field-surface">
                  <PlayDiagram
                    players={formation.players}
                    className="absolute inset-0 h-full w-full"
                    dark
                    ariaLabel={`${formation.name} formation`}
                  />
                  <div className="absolute left-3 top-3">
                    <span className="rounded-md border border-white/10 bg-ink-950/70 px-2 py-1 text-[0.6rem] font-semibold text-chalk backdrop-blur">
                      {formation.players.length} players
                    </span>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/75 text-chalk backdrop-blur hover:bg-ink-800"
                      onClick={(event) => {
                        event.stopPropagation()
                        setEditor({ formation, isNew: false })
                      }}
                      aria-label={`Edit ${formation.name}`}
                      title="Edit formation"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon-btn border border-white/10 bg-ink-950/75 text-chalk backdrop-blur hover:bg-coral/20 hover:text-coral"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(formation)
                      }}
                      aria-label={`Delete ${formation.name}`}
                      title="Delete formation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-white/10 bg-ink-950/80 px-2.5 py-1 text-[0.62rem] font-semibold text-chalk opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    Edit alignment
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="truncate font-display text-[1.02rem] font-bold tracking-tight text-chalk">
                    {formation.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                    <span className="text-[0.62rem] text-slate-moss">
                      {usage ? `Used by ${usage} play${usage === 1 ? '' : 's'}` : 'Not used yet'}
                    </span>
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-slate-moss">
                      5v5
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <FormationLibraryEditor
        open={Boolean(editor)}
        formation={editor?.formation ?? null}
        isNew={editor?.isNew ?? true}
        existingNames={editingNames}
        affectedPlays={
          editor && !editor.isNew ? formationUsage(playbook, editor.formation.id) : 0
        }
        onClose={() => setEditor(null)}
        onSave={saveFormation}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this formation?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the formation library.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
              Keep formation
            </button>
            {!deleteBlocked && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (deleteTarget) deleteFormation(deleteTarget.id)
                  setDeleteTarget(null)
                }}
              >
                <Trash2 size={14} />
                Delete formation
              </button>
            )}
          </div>
        }
      >
        {targetUsage > 0 ? (
          <div className="rounded-xl border border-coral/25 bg-coral/[0.06] p-3.5">
            <p className="text-sm font-semibold text-coral">
              This formation is still in use.
            </p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-fog">
              {targetUsage} play{targetUsage === 1 ? '' : 's'} start from it.
              Delete those plays first, then remove the formation.
            </p>
          </div>
        ) : isLastFormation ? (
          <div className="rounded-xl border border-coral/25 bg-coral/[0.06] p-3.5">
            <p className="text-sm font-semibold text-coral">
              Keep at least one formation.
            </p>
            <p className="mt-1 text-[0.76rem] leading-relaxed text-fog">
              New plays need a starting lineup. Add another formation before
              deleting this one.
            </p>
          </div>
        ) : (
          <p className="text-sm text-fog">
            This changes the starting lineup for future plays. Existing plays do
            not use this formation.
          </p>
        )}
      </Modal>
    </>
  )
}
