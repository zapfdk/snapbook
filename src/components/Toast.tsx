import { useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { cx } from '../lib/files'

export interface ToastMessage {
  id: number
  kind: 'success' | 'error'
  text: string
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => dismissRef.current(), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div
      className={cx(
        'fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-lg',
        toast.kind === 'success'
          ? 'border-lime/30 bg-[#16200f]/95 text-chalk'
          : 'border-coral/30 bg-[#231410]/95 text-chalk',
      )}
      role="status"
    >
      {toast.kind === 'success' ? (
        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-lime" />
      ) : (
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-coral" />
      )}
      <p className="text-[0.76rem] leading-relaxed">{toast.text}</p>
      <button className="icon-btn !h-5 !w-5 shrink-0" onClick={onDismiss} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  )
}
