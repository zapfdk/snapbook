import { RefreshCw, X } from 'lucide-react'

interface UpdatePromptProps {
  ready: boolean
  onReload: () => void
  onDismiss: () => void
}

export function UpdatePrompt({ ready, onReload, onDismiss }: UpdatePromptProps) {
  if (!ready) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-lime/30 bg-[#16200f]/95 px-4 py-3 shadow-2xl backdrop-blur-lg"
        role="status"
        aria-live="polite"
      >
        <RefreshCw size={17} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[0.76rem] leading-relaxed text-chalk">
          A new version of Snapbook is ready.
        </p>
        <button className="btn btn-primary !px-3 !py-1.5 !text-[0.72rem]" onClick={onReload}>
          Reload
        </button>
        <button
          className="icon-btn !h-6 !w-6 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss update notice"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
