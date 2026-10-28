import { useEffect, useState } from 'react'
import { ArrowRight, Check, Download, Layers3, Upload } from 'lucide-react'
import { Modal } from './Modal'
import { DEFAULT_ROUTE_LIBRARY } from '../data/routeLibrary'
import type { PlaybookFill } from '../data/defaults'
import { cx } from '../lib/files'

interface NewPlaybookDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, team: string, fill: PlaybookFill) => void
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
  const [fill, setFill] = useState<PlaybookFill>('starter')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setTeam('')
    setFill('starter')
    setError('')
  }, [open])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the playbook a name.')
      return
    }
    onCreate(trimmed, team.trim(), fill)
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

        <div>
          <span className="label">Fill it with</span>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <FillOption
              active={fill === 'starter'}
              onClick={() => setFill('starter')}
              title="Starter set"
              detail={`Six formations, four tags and the ${DEFAULT_ROUTE_LIBRARY.length} route presets.`}
            />
            <FillOption
              active={fill === 'clean'}
              onClick={() => setFill('clean')}
              title="Clean sheet"
              detail="One lineup to start from, no tags and an empty route library."
            />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-ink-900 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime">
              <Layers3 size={16} />
            </span>
            <div>
              <p className="text-[0.8rem] font-semibold text-chalk">
                No plays yet, whichever you pick
              </p>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-moss">
                Add your first play from the Playbook screen. Everything you create is saved
                automatically in this browser, and tags and routes can be added later.
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

function FillOption({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean
  onClick: () => void
  title: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
        active
          ? 'border-lime/70 bg-lime/[0.05] ring-1 ring-lime/30'
          : 'border-line bg-ink-900 hover:border-[#3a4c3f]',
      )}
    >
      <span
        className={cx(
          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          active ? 'border-lime bg-lime text-ink-950' : 'border-line text-transparent',
        )}
      >
        <Check size={11} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.8rem] font-semibold text-chalk">{title}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-slate-moss">{detail}</span>
      </span>
    </button>
  )
}
