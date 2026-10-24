import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Link2, Lock } from 'lucide-react'
import { Modal } from './Modal'
import { createShareLink } from '../lib/share'
import type { Playbook } from '../types'

interface ShareDialogProps {
  open: boolean
  playbook: Playbook
  onClose: () => void
  onNotify: (text: string, kind?: 'success' | 'error') => void
}

export function ShareDialog({ open, playbook, onClose, onNotify }: ShareDialogProps) {
  const link = useMemo(() => {
    if (!open) return ''
    try {
      return createShareLink(playbook, window.location.href.split('#')[0])
    } catch {
      return ''
    }
  }, [open, playbook])
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setCopied(false)
  }, [link])

  const copyLink = async () => {
    if (!link) return
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        onNotify('Share link copied to the clipboard.')
        return
      } catch {
        // Fall through to the selection-based copy for older or restricted browsers.
      }
    }

    const input = inputRef.current
    input?.focus()
    input?.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    if (copied) {
      setCopied(true)
      onNotify('Share link copied to the clipboard.')
    } else {
      onNotify('The link is selected — press Ctrl+C to copy it.', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this playbook"
      description="Anyone with the link can read every play, route and formation."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[0.68rem] text-slate-moss">
            <Lock size={12} className="text-lime" />
            Read-only · does not change the recipient’s playbook
          </span>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={copyLink} disabled={!link}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      }
    >
      <div className="rounded-xl border border-line bg-ink-900 p-3">
        <div className="flex items-center gap-2 text-[0.72rem] font-semibold text-chalk">
          <Link2 size={14} className="text-lime" />
          {playbook.name}
        </div>
        {link ? (
          <textarea
            ref={inputRef}
            readOnly
            value={link}
            rows={4}
            className="input mt-2 resize-none font-mono !text-[0.64rem] leading-relaxed text-fog"
            aria-label="Share link"
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : (
          <p className="mt-2 text-[0.76rem] text-coral">
            This playbook can’t be shared right now. Check its formations and try again.
          </p>
        )}
        <p className="mt-2 text-[0.68rem] leading-relaxed text-slate-moss">
          The whole playbook travels inside the link itself, so nothing is uploaded.
          Links can be long; send the complete link in one piece.
        </p>
      </div>
    </Modal>
  )
}
