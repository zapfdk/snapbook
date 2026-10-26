import { useEffect, useState } from 'react'
import { ArrowRight, Download, Layers3, Upload } from 'lucide-react'
import { Modal } from './Modal'

interface NewPlaybookDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, team: string) => void
  onImport: () => void
  onBackup: () => void
}

export function NewPlaybookDialog({
  open,
  onClose,
  onCreate,
  onImport,
  onBackup,
}: NewPlaybookDialogProps) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setTeam('')
    setError('')
  }, [open])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the playbook a name.')
      return
    }
    onCreate(trimmed, team.trim())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New playbook"
      description="Start with a clean sheet. It joins your playbooks, so the one you have open is left as it is."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button className="btn btn-ghost !px-0" onClick={onImport}>
            <Upload size={14} />
            Import instead
          </button>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit}>
              Create playbook
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="label">Playbook name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="e.g. Friday night"
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Team / squad</span>
            <input
              className="input"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              placeholder="Optional"
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
            />
          </label>
        </div>

        <div className="rounded-xl border border-line bg-ink-900 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime">
              <Layers3 size={16} />
            </span>
            <div>
              <p className="text-[0.8rem] font-semibold text-chalk">
                Starter formations and tags, no plays yet
              </p>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-moss">
                Add your first play from the Playbook screen. Everything you create is saved
                automatically in this browser.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-ink-900/60 px-3 py-2.5 text-[0.7rem] leading-relaxed text-fog">
          <p className="flex items-start gap-2">
            <Layers3 size={14} className="mt-0.5 shrink-0 text-lime" />
            <span>
              It is stored beside your other playbooks, and a connected Dropbox syncs
              the whole set. Switch between them from the playbook button in the header.
            </span>
          </p>
          <button
            className="mt-2 inline-flex items-center gap-1 font-semibold text-fog underline decoration-line underline-offset-2 hover:text-chalk"
            onClick={onBackup}
          >
            <Download size={12} />
            Download a backup of the open playbook
          </button>
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
