import { ArrowUpRight } from 'lucide-react'
import { Modal } from './Modal'
import type { Play } from '../types'

export interface PlayUsageRow {
  play: Play
  /** Formation, receivers or anything else worth naming under the play. */
  detail?: string
}

/**
 * The plays behind a formation or a route, opened from the card that counts
 * them. Picking one closes the dialog and opens it in the designer.
 */
export function PlayUsageDialog({
  open,
  title,
  description,
  rows,
  empty,
  onClose,
  onOpenPlay,
}: {
  open: boolean
  title: string
  description?: string
  rows: PlayUsageRow[]
  empty: string
  onClose: () => void
  onOpenPlay: (playId: string) => void
}) {
  const openPlay = (playId: string) => {
    onClose()
    onOpenPlay(playId)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {rows.length ? (
        <div className="grid max-h-[52vh] gap-1.5 overflow-y-auto">
          {rows.map(({ play, detail }) => (
            <button
              key={play.id}
              onClick={() => openPlay(play.id)}
              className="flex items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-left transition-colors hover:border-[#3b4e40] hover:bg-ink-850"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-semibold text-chalk">
                  {play.name}
                </span>
                {detail && (
                  <span className="block truncate text-[0.66rem] text-slate-moss">{detail}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-lime/80">
                Open
                <ArrowUpRight size={13} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
          <p className="text-sm text-fog">{empty}</p>
        </div>
      )}
    </Modal>
  )
}
