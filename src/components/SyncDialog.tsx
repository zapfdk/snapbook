import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import type { CloudSyncState } from '../lib/cloudSync'
import { dropboxRedirectUri } from '../lib/dropbox'
import { cx } from '../lib/files'
import type { Playbook } from '../types'
import { Modal } from './Modal'

interface SyncDialogProps {
  open: boolean
  onClose: () => void
  sync: CloudSyncState
  localPlaybook: Playbook
  onConnect: () => void
  onDisconnect: () => void
  onSyncNow: () => void
  onResolveConflict: (choice: 'local' | 'remote') => void
  onExportBackup: () => void
}

export function SyncDialog({
  open,
  onClose,
  sync,
  localPlaybook,
  onConnect,
  onDisconnect,
  onSyncNow,
  onResolveConflict,
  onExportBackup,
}: SyncDialogProps) {
  const busy = sync.phase === 'syncing' || sync.phase === 'connecting'
  const connected = Boolean(sync.accountLabel)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cloud sync"
      description="Keep one playbook in step across the devices you use."
    >
      {!sync.configured ? (
        <DropboxSetup />
      ) : (
        <div className="grid gap-4">
          {sync.conflict ? (
            <ConflictPanel
              conflict={sync.conflict}
              localPlaybook={localPlaybook}
              busy={busy}
              onResolveConflict={onResolveConflict}
              onExportBackup={onExportBackup}
            />
          ) : (
            <>
              {connected ? (
                <ConnectedPanel sync={sync} busy={busy} />
              ) : (
                <ConnectPanel phase={sync.phase} busy={busy} onConnect={onConnect} />
              )}

              {sync.error && <ErrorNotice message={sync.error} />}

              {connected && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-primary" onClick={onSyncNow} disabled={busy}>
                    <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
                    {busy ? 'Syncing…' : sync.phase === 'error' ? 'Try again' : 'Sync now'}
                  </button>
                  {sync.phase === 'error' && (
                    <button className="btn btn-secondary" onClick={onConnect}>
                      Reconnect Dropbox
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={onDisconnect}>
                    <Unplug size={14} />
                    Disconnect
                  </button>
                </div>
              )}

            </>
          )}

          <WhatSyncs />
        </div>
      )}
    </Modal>
  )
}

function DropboxSetup() {
  const redirectUri = dropboxRedirectUri()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
    } catch {
      // The URI is visible below so it can still be copied by hand.
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3 rounded-xl border border-line bg-ink-900 px-4 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-fog">
          <CloudOff size={17} />
        </span>
        <div>
          <p className="text-sm font-semibold text-chalk">Dropbox sync is not configured</p>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-fog">
            This build has no Dropbox app key, so the connect button stays off. The
            editor and local saving continue to work.
          </p>
        </div>
      </div>

      <ol className="mt-4 grid gap-3 text-[0.74rem] leading-relaxed text-fog">
        <SetupStep number={1}>
          In the{' '}
          <a
            href="https://www.dropbox.com/developers/apps"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-lime hover:underline"
          >
            Dropbox App Console
            <ExternalLink size={11} />
          </a>
          , create a <strong className="font-semibold text-chalk">Scoped access</strong> app
          with <strong className="font-semibold text-chalk">App folder</strong> access.
        </SetupStep>
        <SetupStep number={2}>
          On its Permissions tab, enable{' '}
          <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[0.66rem] text-chalk">
            account_info.read
          </code>
          ,{' '}
          <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[0.66rem] text-chalk">
            files.content.read
          </code>{' '}
          and{' '}
          <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[0.66rem] text-chalk">
            files.content.write
          </code>{' '}
          and{' '}
          <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[0.66rem] text-chalk">
            files.metadata.read
          </code>
          .
        </SetupStep>
        <SetupStep number={3}>
          On the OAuth 2 tab, add this exact redirect URI:
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-2.5 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[0.66rem] text-chalk">
              {redirectUri}
            </code>
            <button
              className="icon-btn shrink-0"
              onClick={copyRedirect}
              aria-label="Copy redirect URI"
              title={copied ? 'Copied' : 'Copy redirect URI'}
            >
              {copied ? <Check size={14} className="text-lime" /> : <Copy size={14} />}
            </button>
          </div>
        </SetupStep>
        <SetupStep number={4}>
          Add the app key as{' '}
          <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[0.66rem] text-chalk">
            VITE_DROPBOX_APP_KEY
          </code>{' '}
          in <code className="font-mono text-[0.66rem] text-chalk">.env.local</code> for
          local development, or as a repository variable for the GitHub Pages build, then
          rebuild.
        </SetupStep>
      </ol>

      <p className="mt-4 rounded-xl border border-lime/20 bg-lime/[0.045] px-3 py-2.5 text-[0.7rem] leading-relaxed text-fog">
        The browser uses PKCE, so no app secret is stored in this repository or sent to
        the page. Snapbook only receives access to its own app folder.
      </p>
    </div>
  )
}

function SetupStep({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-800 font-mono text-[0.6rem] font-bold text-lime">
        {number}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function ConnectPanel({
  phase,
  busy,
  onConnect,
}: {
  phase: CloudSyncState['phase']
  busy: boolean
  onConnect: () => void
}) {
  return (
    <div className="rounded-xl border border-line bg-ink-900 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime">
          <Cloud size={17} />
        </span>
        <div>
          <p className="text-sm font-semibold text-chalk">Connect your Dropbox</p>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-fog">
            Snapbook writes one file to its own app folder. It cannot browse the rest of
            your Dropbox, and nothing syncs until you connect.
          </p>
        </div>
      </div>
      <button
        className="btn btn-primary mt-4 w-full justify-center sm:w-auto"
        onClick={onConnect}
        disabled={busy}
      >
        <ExternalLink size={14} />
        {phase === 'connecting' ? 'Opening Dropbox…' : 'Connect Dropbox'}
      </button>
    </div>
  )
}

function ConnectedPanel({ sync, busy }: { sync: CloudSyncState; busy: boolean }) {
  const hasError = sync.phase === 'error'
  return (
    <div className="rounded-xl border border-line bg-ink-900 px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime">
          <Cloud size={17} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-chalk">{sync.accountLabel}</p>
          <p className="mt-0.5 text-[0.68rem] text-slate-moss">Dropbox · app folder</p>
        </div>
        <span
          className={cx(
            'chip ml-auto shrink-0',
            hasError
              ? '!border-coral/30 !bg-coral/10 !text-[#ffb7a6]'
              : busy
                ? '!border-lime/25 !bg-lime/10 !text-lime'
                : '!border-lime/25 !bg-lime/10 !text-lime',
          )}
        >
          <span
            className={cx(
              'h-1.5 w-1.5 rounded-full',
              hasError ? 'bg-coral' : busy ? 'animate-pulse bg-lime' : 'bg-lime',
            )}
          />
          {hasError ? 'Needs attention' : busy ? 'Syncing' : 'Synced'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-line/70 pt-3 text-[0.68rem] text-slate-moss">
        <Check size={12} className={hasError ? 'text-slate-moss' : 'text-lime'} />
        {sync.lastSyncedAt
          ? `Last synced ${formatSyncedAt(sync.lastSyncedAt)}`
          : 'The first sync will happen after Dropbox responds.'}
      </div>
    </div>
  )
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-coral/25 bg-coral/[0.06] px-3.5 py-3 text-[0.72rem] leading-relaxed text-[#ffb7a6]">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-coral" />
      <p>{message}</p>
    </div>
  )
}

function ConflictPanel({
  conflict,
  localPlaybook,
  busy,
  onResolveConflict,
  onExportBackup,
}: {
  conflict: NonNullable<CloudSyncState['conflict']>
  localPlaybook: Playbook
  busy: boolean
  onResolveConflict: (choice: 'local' | 'remote') => void
  onExportBackup: () => void
}) {
  return (
    <div className="rounded-xl border border-coral/30 bg-coral/[0.055] px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-coral/10 text-coral">
          <AlertTriangle size={17} />
        </span>
        <div>
          <p className="text-sm font-semibold text-chalk">Both copies changed</p>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-fog">
            Dropbox has changes this browser has not seen, and this browser has its own
            unsynced edits. Nothing has been overwritten.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CompareCard
          title="This browser"
          playbook={localPlaybook}
          tone="local"
        />
        <CompareCard
          title="Dropbox"
          playbook={conflict.remotePlaybook}
          tone="remote"
        />
      </div>

      <div className="mt-4 grid gap-2">
        <button
          className="btn btn-primary w-full justify-center"
          onClick={() => onResolveConflict('local')}
          disabled={busy}
        >
          Keep this browser’s copy
        </button>
        <button
          className="btn btn-secondary w-full justify-center"
          onClick={() => onResolveConflict('remote')}
          disabled={busy}
        >
          Use the Dropbox copy
        </button>
        <button
          className="btn btn-ghost w-full justify-center !text-fog"
          onClick={onExportBackup}
        >
          <Download size={14} />
          Download a backup of this browser first
        </button>
      </div>
      <p className="mt-3 text-[0.66rem] leading-relaxed text-slate-moss">
        Keeping this browser overwrites the Dropbox file. Using the Dropbox copy replaces
        the playbook here; wrist-coach and route-tree settings stay on this device either
        way.
      </p>
    </div>
  )
}

function CompareCard({
  title,
  playbook,
  tone,
}: {
  title: string
  playbook: Playbook
  tone: 'local' | 'remote'
}) {
  return (
    <div
      className={cx(
        'rounded-lg border px-3 py-2.5',
        tone === 'local'
          ? 'border-line bg-ink-900'
          : 'border-[#3a4b3f] bg-ink-850',
      )}
    >
      <p className="mono-label">{title}</p>
      <p className="mt-1 truncate text-[0.78rem] font-semibold text-chalk">
        {playbook.name}
      </p>
      <p className="mt-0.5 text-[0.64rem] text-slate-moss">
        {playbook.plays.length} plays · {playbook.formations.length} formations ·{' '}
        {playbook.routes.length} routes
      </p>
    </div>
  )
}

function WhatSyncs() {
  return (
    <div className="rounded-xl border border-line/80 bg-ink-900/60 px-3.5 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.11em] text-slate-moss">
        What syncs
      </p>
      <p className="mt-1.5 text-[0.7rem] leading-relaxed text-fog">
        The whole playbook — plays, formations, routes, tags, team roster and names — is
        stored as one readable <span className="font-mono text-[0.66rem]">snapbook.json</span>{' '}
        file. Wrist-coach and route-tree settings stay on each device. Local saving keeps
        working when sync is off.
      </p>
    </div>
  )
}

function formatSyncedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
