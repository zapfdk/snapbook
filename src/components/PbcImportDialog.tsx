import { useEffect, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Modal } from './Modal'
import type { Playbook } from '../types'
import { PbcImportError, importPbcFile } from '../lib/pbc/importPbc'

export interface PbcImportRequest {
  fileName: string
  bytes: Uint8Array
}

interface PbcImportDialogProps {
  /** The chosen .pbc file, or null when the dialog is closed. */
  file: PbcImportRequest | null
  onClose: () => void
  onImported: (playbook: Playbook) => void
}

/**
 * Opening a .pbc file needs its password before anything can be read — the
 * archive inside is AES-256 encrypted, and the password cannot be recovered.
 */
export function PbcImportDialog({ file, onClose, onImported }: PbcImportDialogProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) return
    setPassword('')
    setShow(false)
    setError('')
    setBusy(false)
  }, [file])

  const openFile = async () => {
    if (!file) return
    // An empty password is a real answer: it opens a file saved without one.
    setBusy(true)
    setError('')
    try {
      const playbook = await importPbcFile(file.bytes, password)
      onImported(playbook)
      onClose()
    } catch (err) {
      setError(
        err instanceof PbcImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'That .pbc file could not be read.',
      )
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(file)}
      onClose={onClose}
      title="Open a Playbook Creator file"
      description="Read a password-protected .pbc file into its own Snapbook playbook."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.68rem] text-slate-moss">{file?.fileName}</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={openFile} disabled={busy}>
              <Lock size={15} />
              {busy ? 'Unlocking…' : 'Unlock .pbc'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5">
        <div className="flex gap-3 rounded-xl border border-lime/20 bg-lime/[0.05] p-3.5">
          <Lock size={18} className="mt-0.5 shrink-0 text-lime" />
          <div>
            <p className="text-[0.78rem] font-semibold text-chalk">
              The password is the one set when the file was saved
            </p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-fog">
              Leave the field empty for a file that was saved without a
              password. Playbook Creator passwords cannot be recovered — not by
              Snapbook and not by the app that wrote the file. Nothing is
              written to your library until you confirm the playbook that comes
              out.
            </p>
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="label">Password</span>
          <div className="relative">
            <input
              className="input pr-10 font-mono"
              type={show ? 'text' : 'password'}
              value={password}
              autoFocus
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              placeholder="Password, or empty if the file has none"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void openFile()
              }}
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

        <div className="rounded-xl border border-line bg-ink-900 p-3.5">
          <p className="label">What carries over</p>
          <ul className="mt-2 grid gap-1.5 text-[0.72rem] leading-relaxed text-fog">
            <li>· Player alignments, routes, motions, numbers and labels</li>
            <li>· Play names, wrist codes, notes and Playbook Creator's route tags</li>
            <li>· Formations and tags, as their own playbook in your library</li>
            <li>
              · Playbook Creator's route library, beside Snapbook's own presets
            </li>
            <li>· Route curves come back as the bows you can still edit here</li>
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
