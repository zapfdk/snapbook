import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  FileArchive,
  FileJson,
  GitFork,
  Grid2X2,
  Library,
  PenTool,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  Upload,
  Users,
} from 'lucide-react'
import type { CloudSyncPhase } from '../lib/cloudSync'
import { cx } from '../lib/files'
import { Logo } from './Logo'

export type View = 'plays' | 'design' | 'wrist' | 'tree' | 'team'

interface AppHeaderProps {
  view: View
  onView: (view: View) => void
  playbookName: string
  playbookCount: number
  onLibrary: () => void
  onNewPlay: () => void
  onExportPdf: () => void
  onExportRouteTree: () => void
  onExportPbc: () => void
  onExportNative: () => void
  onImport: () => void
  onShare: () => void
  onSync: () => void
  syncPhase: CloudSyncPhase
}

const navItems: Array<{ id: View; label: string; icon: typeof Grid2X2 }> = [
  { id: 'plays', label: 'Playbook', icon: Grid2X2 },
  { id: 'design', label: 'Designer', icon: PenTool },
  { id: 'wrist', label: 'Wrist coach', icon: Printer },
  { id: 'tree', label: 'Route tree', icon: GitFork },
  { id: 'team', label: 'Team', icon: Users },
]

export function AppHeader({
  view,
  onView,
  playbookName,
  playbookCount,
  onLibrary,
  onNewPlay,
  onExportPdf,
  onExportRouteTree,
  onExportPbc,
  onExportNative,
  onImport,
  onShare,
  onSync,
  syncPhase,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const syncBusy = syncPhase === 'connecting' || syncPhase === 'syncing'
  const syncNeedsAttention = syncPhase === 'conflict' || syncPhase === 'error'
  const syncLabel =
    syncPhase === 'connected'
      ? 'Cloud sync — connected and up to date'
      : syncPhase === 'conflict'
        ? 'Cloud sync — both copies changed'
        : syncPhase === 'error'
          ? 'Cloud sync — needs attention'
          : syncBusy
            ? 'Cloud sync — syncing'
            : 'Cloud sync — not connected'
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const run = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-1 px-4 sm:gap-4 sm:px-6">
        <button
          onClick={() => onView('plays')}
          className="shrink-0 rounded-lg text-left focus-visible:outline-offset-4"
          aria-label="Go to playbook"
        >
          <Logo />
        </button>

        <button
          className="btn btn-secondary !px-2 min-[380px]:!px-3"
          onClick={onLibrary}
          aria-label="Switch playbook"
          aria-haspopup="dialog"
          title={
            playbookCount === 1
              ? 'Your playbooks — one saved in this browser'
              : `Your playbooks — ${playbookCount} saved in this browser`
          }
        >
          <Library size={15} />
          <span className="hidden max-w-[10rem] truncate lg:inline">{playbookName}</span>
          <span className="chip !border-line !bg-ink-850 !px-1.5 !text-[0.6rem] !text-slate-moss">
            {playbookCount}
          </span>
          <ChevronDown size={14} className="hidden min-[380px]:block" />
        </button>

        <nav
          className="mx-auto flex items-center gap-0 rounded-xl border border-line bg-ink-900 p-1 sm:gap-0.5"
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => onView(item.id)}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-1.5 py-2 text-[0.76rem] font-semibold transition-colors sm:px-3.5',
                  active
                    ? 'bg-ink-750 text-chalk shadow-sm'
                    : 'text-slate-moss hover:text-chalk',
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className="btn btn-primary hidden md:inline-flex"
            onClick={onNewPlay}
            aria-label="New play"
          >
            <Plus size={15} />
            New play
          </button>
          <button
            className="btn btn-secondary !px-2 min-[380px]:!px-4"
            onClick={onShare}
            aria-label="Share playbook"
            title="Share a read-only link with merge and edit options"
          >
            <Share2 size={15} />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            className={cx(
              'btn btn-secondary !px-2 min-[380px]:!px-4',
              syncPhase === 'connected' && '!text-lime',
              syncNeedsAttention && '!border-coral/30 !text-coral',
            )}
            onClick={onSync}
            aria-label="Cloud sync"
            title={syncLabel}
          >
            {syncPhase === 'connected' ? (
              <Cloud size={15} />
            ) : syncNeedsAttention ? (
              <AlertTriangle size={15} />
            ) : syncBusy ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <CloudOff size={15} />
            )}
            <span className="hidden sm:inline">Sync</span>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="btn btn-secondary !px-2 min-[380px]:!px-4"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Export"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown
                size={14}
                className={cx(
                  'hidden min-[380px]:block',
                  menuOpen ? 'rotate-180 transition' : 'transition',
                )}
              />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] w-72 overflow-hidden rounded-xl border border-line bg-ink-850 p-1.5 shadow-2xl"
              >
                <MenuItem
                  icon={<Printer size={16} />}
                  title="Wrist coach PDF"
                  detail="Print-ready cards in your exact insert size"
                  onClick={() => run(onExportPdf)}
                />
                <MenuItem
                  icon={<GitFork size={16} />}
                  title="Route tree poster"
                  detail="A full-field, numbered passing tree"
                  onClick={() => run(onExportRouteTree)}
                />
                <MenuItem
                  icon={<FileJson size={16} />}
                  title="Snapbook file"
                  detail="Readable .snapbook.json backup you can edit"
                  onClick={() => run(onExportNative)}
                />
                <MenuItem
                  icon={<FileArchive size={16} />}
                  title="Playbook Creator (.pbc)"
                  detail="Password-protected, opens in PBC desktop"
                  onClick={() => run(onExportPbc)}
                />
                <div className="my-1 h-px bg-line" />
                <MenuItem
                  icon={<Upload size={16} />}
                  title="Import a playbook"
                  detail="Snapbook JSON files, including older backups"
                  onClick={() => run(onImport)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuItem({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ink-750"
    >
      <span className="mt-0.5 text-fog">{icon}</span>
      <span>
        <span className="block text-[0.8rem] font-semibold text-chalk">{title}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-slate-moss">{detail}</span>
      </span>
    </button>
  )
}
