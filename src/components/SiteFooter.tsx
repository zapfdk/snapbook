import { cx } from '../lib/files'

/**
 * The privacy page is a static document next to the app, so the link is
 * relative: it keeps working both at `/` and under a GitHub Pages subpath.
 */
export function SiteFooter({ className, note = 'Snapbook · 5v5 play studio' }: {
  className?: string
  note?: string
}) {
  return (
    <footer
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5 text-[0.68rem] text-slate-moss',
        className,
      )}
    >
      <span>{note}</span>
      <a className="transition-colors hover:text-chalk" href="./privacy.html">
        Privacy policy
      </a>
    </footer>
  )
}
