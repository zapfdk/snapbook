import { useEffect, useState } from 'react'
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Modal } from './Modal'
import { cx } from '../lib/files'
import type { Playbook } from '../types'

interface PlaybookLibraryDialogProps {
  open: boolean
  onClose: () => void
  playbooks: Playbook[]
  activeId: string
  syncConnected: boolean
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onImport: () => void
  onSync: () => void
}

/**
 * Every playbook in this browser, so a coach can pick which one they are
 * editing. Cloud sync stores the same set in one Dropbox file, so a playbook
 * added or removed here travels to the other devices too.
 */
export function PlaybookLibraryDialog({
  open,
  onClose,
  playbooks,
  activeId,
  syncConnected,
  onSelect,
  onDuplicate,
  onDelete,
  onNew,
  onImport,
  onSync,
}: PlaybookLibraryDialogProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setConfirmId(null)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your playbooks"
      description="Pick the playbook you want to edit. Everything listed here is saved in this browser."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button className="btn btn-ghost !px-0 !text-[0.72rem]" onClick={onSync}>
            {syncConnected ? (
              <Cloud size={14} className="text-lime" />
            ) : (
              <CloudOff size={14} />
            )}
            {syncConnected
              ? `${playbooks.length === 1 ? 'This playbook syncs' : 'These playbooks sync'} to Dropbox`
              : 'Set up cloud sync'}
          </button>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={onImport}>
              <Upload size={14} />
              Import file
            </button>
            <button className="btn btn-primary" onClick={onNew}>
              <Plus size={15} />
              New playbook
            </button>
          </div>
        </div>
      }
    >
      <ul className="grid gap-2">
        {playbooks.map((playbook) => {
          const active = playbook.id === activeId
          const confirming = confirmId === playbook.id
          const lastOnly = playbooks.length <= 1
          return (
            <li
              key={playbook.id}
              className={cx(
                'rounded-xl border px-3.5 py-3 transition-colors',
                active
                  ? 'border-lime/35 bg-lime/[0.05]'
                  : 'border-line bg-ink-900 hover:border-[#34453a]',
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(playbook.id)}
                  aria-label={`Edit ${playbook.name}`}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[0.95rem] font-bold text-chalk">
                      {playbook.name}
                    </span>
                    {active && (
                      <span className="chip !border-lime/30 !bg-lime/10 !text-lime">
                        <Check size={11} />
                        Editing
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block font-mono text-[0.62rem] uppercase tracking-[0.08em] text-slate-moss">
                    {playbook.team ? `${playbook.team} · ` : ''}
                    {playbook.level} flag · {playbook.plays.length} plays ·{' '}
                    {playbook.formations.length} formations
                  </span>
                </button>
                <div className="flex shrink-0 items-center">
                  <button
                    className="icon-btn"
                    onClick={() => onDuplicate(playbook.id)}
                    aria-label={`Duplicate ${playbook.name}`}
                    title="Duplicate this playbook"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setConfirmId(confirming ? null : playbook.id)}
                    disabled={lastOnly}
                    aria-label={`Delete ${playbook.name}`}
                    title={
                      lastOnly
                        ? 'Keep at least one playbook'
                        : 'Delete this playbook'
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {confirming && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-coral/30 bg-coral/[0.07] px-3 py-2.5">
                  <p className="flex min-w-0 flex-1 items-start gap-2 text-[0.72rem] leading-relaxed text-[#ffb7a6]">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0 text-coral" />
                    <span>
                      Delete “{playbook.name}”
                      {playbook.plays.length
                        ? ` and its ${playbook.plays.length} ${
                            playbook.plays.length === 1 ? 'play' : 'plays'
                          }`
                        : ''}
                      ? Syncing is updated to match, so it goes from Dropbox too.
                    </span>
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="btn btn-danger !px-3 !py-1.5 !text-[0.72rem]"
                      onClick={() => {
                        onDelete(playbook.id)
                        setConfirmId(null)
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="btn btn-ghost !px-3 !py-1.5 !text-[0.72rem]"
                      onClick={() => setConfirmId(null)}
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 rounded-xl border border-line/80 bg-ink-900/60 px-3.5 py-3 text-[0.7rem] leading-relaxed text-fog">
        Wrist-coach pages, route-tree options and print settings follow the playbook you
        edit here. With cloud sync connected, one Dropbox file holds all of these, and
        edits to different playbooks on two devices merge on their own.
      </p>
    </Modal>
  )
}
