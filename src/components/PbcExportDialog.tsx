import { useEffect, useState } from 'react'
import { Eye, EyeOff, FileArchive, ShieldCheck } from 'lucide-react'
import { Modal } from './Modal'
import type { Playbook } from '../types'
import {
  PbcExportError,
  createPbcFile,
  downloadPbcFile,
  pbcFileName,
} from '../lib/pbc/exportPbc'

interface PbcExportDialogProps {
  open: boolean
  onClose: () => void
  playbook: Playbook
  onSuccess: (message: string) => void
}

export function PbcExportDialog({
  open,
  onClose,
  playbook,
  onSuccess,
}: PbcExportDialogProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirm('')
    setShow(false)
    setError('')
    setBusy(false)
  }, [open])

  const exportFile = async () => {
    if (password.length < 4) {
      setError('Use at least 4 characters for the password.')
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const bytes = await createPbcFile(playbook, password)
      downloadPbcFile(bytes, pbcFileName(playbook.name))
      onSuccess(
        'PBC file exported. Open it in Playbook Creator with the password you just set.',
      )
      onClose()
    } catch (err) {
      setError(
        err instanceof PbcExportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'The PBC export failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export for Playbook Creator"
      description="A password-protected .pbc file with plays, formations, categories and notes."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.68rem] text-slate-moss">
            {playbook.plays.length} plays · {playbook.formations.length} formations
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={exportFile} disabled={busy}>
              <FileArchive size={15} />
              {busy ? 'Encrypting…' : 'Export .pbc'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5">
        <div className="flex gap-3 rounded-xl border border-lime/20 bg-lime/[0.05] p-3.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-lime" />
          <div>
            <p className="text-[0.78rem] font-semibold text-chalk">
              Compatible with Playbook Creator 0.22
            </p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-fog">
              PBC uses AES-256 encryption. Your password is never stored and
              can’t be recovered. Keep it somewhere safe.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="label">Password</span>
            <div className="relative">
              <input
                className="input pr-10 font-mono"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                placeholder="At least 4 characters"
              />
              <button
                className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? 'Hide password' : 'Show password'}
                type="button"
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>
          <label className="grid gap-1.5">
            <span className="label">Confirm password</span>
            <input
              className="input font-mono"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value)
                setError('')
              }}
              placeholder="Repeat the password"
              onKeyDown={(event) => {
                if (event.key === 'Enter') exportFile()
              }}
            />
          </label>
        </div>

        <div className="rounded-xl border border-line bg-ink-900 p-3.5">
          <p className="label">What carries over</p>
          <ul className="mt-2 grid gap-1.5 text-[0.72rem] leading-relaxed text-fog">
            <li>· Player alignments, routes, colours, numbers and labels</li>
            <li>· Play names, wrist codes, notes and tags</li>
            <li>· All formations and categories</li>
            <li>
              · Route curves are baked into the play diagram exactly as they
              appear in Snapbook
            </li>
          </ul>
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
