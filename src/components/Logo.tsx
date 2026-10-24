import { cx } from '../lib/files'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-[11px] bg-lime text-lime-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M4 19.5h16M4 14.5h16M4 9.5h16"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.34"
          />
          <path
            d="M7 18.4c2.1 0 2.7-5.6 5.1-5.6 2 0 2.2 3 4.9 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M17 13.1 19.4 16l-3.6 1.3Z" fill="currentColor" />
          <circle cx="7" cy="18.4" r="2.1" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="hidden flex-col leading-none sm:flex">
          <span className="font-display text-[1.03rem] font-extrabold tracking-[-0.04em] text-chalk">
            SNAPBOOK
          </span>
          <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.19em] text-slate-moss">
            5v5 play studio
          </span>
        </span>
      )}
    </div>
  )
}

export function LogoBadge({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-full border border-line bg-ink-900 px-3 py-1.5',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-lime" />
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-fog">
        Saved locally
      </span>
    </div>
  )
}
