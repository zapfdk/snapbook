import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Plus } from 'lucide-react'
import { AppHeader, type View } from './components/AppHeader'
import { Logo } from './components/Logo'
import { NewPlayDialog } from './components/NewPlayDialog'
import { NewPlaybookDialog } from './components/NewPlaybookDialog'
import { PbcExportDialog } from './components/PbcExportDialog'
import { PlaybookLibraryDialog } from './components/PlaybookLibraryDialog'
import { Modal } from './components/Modal'
import { ShareDialog } from './components/ShareDialog'
import { SiteFooter } from './components/SiteFooter'
import { SyncDialog } from './components/SyncDialog'
import { Toast, type ToastMessage } from './components/Toast'
import { UpdatePrompt } from './components/UpdatePrompt'
import { PlaysView } from './views/PlaysView'
import { DesignView } from './views/DesignView'
import { WristCoachView } from './views/WristCoachView'
import { RouteTreeView } from './views/RouteTreeView'
import { TeamView } from './views/TeamView'
import { SharedPlaybookView } from './views/SharedPlaybookView'
import { selectActivePlaybook, usePlaybook } from './store/playbook'
import { useCloudSync } from './hooks/useCloudSync'
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate'
import { exportNative, importNative } from './lib/files'
import { mergeSharedPlaybook } from './lib/mergePlaybook'
import { SHARE_HASH_PREFIX, sharePlaybookFromHash } from './lib/share'
import type { Playbook } from './types'

interface PendingImport {
  fileName: string
  playbook: Playbook
}

interface SharedLink {
  playbook: Playbook | null
  error: string | null
}

/** The play a coach most likely wants when a playbook is opened. */
function newestPlayId(playbook: Playbook): string | null {
  if (!playbook.plays.length) return null
  return [...playbook.plays].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0].id
}

function readSharedLink(): SharedLink | null {
  if (!window.location.hash.startsWith(SHARE_HASH_PREFIX)) return null
  try {
    return { playbook: sharePlaybookFromHash(window.location.hash), error: null }
  } catch (error) {
    return {
      playbook: null,
      error:
        error instanceof Error ? error.message : 'This share link could not be opened.',
    }
  }
}

/**
 * Share links render their own read-only copy of the playbook. The visitor has
 * to explicitly choose “Edit a copy” before anything is written to the
 * playbook persisted in this browser.
 */
export default function App() {
  const [sharedLink, setSharedLink] = useState<SharedLink | null>(readSharedLink)
  const update = useServiceWorkerUpdate()

  useEffect(() => {
    const onHashChange = () => setSharedLink(readSharedLink())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const exitSharedLink = () => {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
    setSharedLink(null)
    window.scrollTo({ top: 0 })
  }

  const editSharedCopy = () => {
    if (!sharedLink?.playbook) return
    // The shared playbook becomes its own entry, so the open playbook is not
    // overwritten by opening a link.
    usePlaybook.getState().addPlaybook(sharedLink.playbook)
    exitSharedLink()
  }

  const mergeSharedCopy = () => {
    if (!sharedLink?.playbook) return
    const state = usePlaybook.getState()
    const active = selectActivePlaybook(state)
    const merged = mergeSharedPlaybook(active, sharedLink.playbook)
    // Merging is additive, so keep the wrist-coach selection the user curated.
    const wristPlays = state.wrist.selectedPlayIds
    state.replaceActivePlaybook(merged.playbook)
    usePlaybook.getState().setWristPlays(wristPlays)
    exitSharedLink()
  }

  const content = sharedLink ? (
    sharedLink.playbook ? (
      <SharedPlaybookView
        playbook={sharedLink.playbook}
        localPlaybook={selectActivePlaybook(usePlaybook.getState())}
        onEdit={editSharedCopy}
        onMerge={mergeSharedCopy}
        onExit={exitSharedLink}
      />
    ) : (
      <InvalidSharedLink
        message={sharedLink.error ?? 'This share link could not be opened.'}
        onExit={exitSharedLink}
      />
    )
  ) : (
    <LocalPlaybookApp />
  )

  return (
    <>
      {content}
      <UpdatePrompt
        ready={update.state.ready}
        onReload={update.apply}
        onDismiss={update.dismiss}
      />
    </>
  )
}

function InvalidSharedLink({ message, onExit }: { message: string; onExit: () => void }) {
  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-line/80 bg-ink-950">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center px-4 sm:px-6 lg:px-8">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pt-20 sm:px-6">
        <div className="panel flex flex-col items-center px-6 py-9 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-coral/10 text-coral">
            <AlertTriangle size={22} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-chalk">
            This share link can’t be opened
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-fog">{message}</p>
          <button className="btn btn-primary mt-5" onClick={onExit}>
            <ArrowLeft size={15} />
            Open my playbook
          </button>
          <p className="mt-4 text-[0.68rem] leading-relaxed text-slate-moss">
            Your own playbook has not been changed.
          </p>
        </div>
      </main>
    </div>
  )
}

function LocalPlaybookApp() {
  const playbook = usePlaybook(selectActivePlaybook)
  const playbooks = usePlaybook((state) => state.playbooks)
  const addPlaybook = usePlaybook((state) => state.addPlaybook)
  const createPlaybook = usePlaybook((state) => state.createPlaybook)
  const selectPlaybook = usePlaybook((state) => state.selectPlaybook)
  const duplicatePlaybook = usePlaybook((state) => state.duplicatePlaybook)
  const deletePlaybook = usePlaybook((state) => state.deletePlaybook)
  const cloud = useCloudSync()

  const [view, setView] = useState<View>('plays')
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [newPlayOpen, setNewPlayOpen] = useState(false)
  const [newPlaybookOpen, setNewPlaybookOpen] = useState(false)
  const [pbcOpen, setPbcOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conflictOpened = useRef(false)

  useEffect(() => {
    if (cloud.state.phase === 'conflict' && !conflictOpened.current) {
      conflictOpened.current = true
      setSyncOpen(true)
    }
    if (cloud.state.phase !== 'conflict') conflictOpened.current = false
  }, [cloud.state.phase])

  const selectedPlay = playbook.plays.find((play) => play.id === selectedPlayId) ?? null

  useEffect(() => {
    if (!playbook.plays.length) {
      if (selectedPlayId) setSelectedPlayId(null)
      return
    }
    if (!selectedPlayId || !playbook.plays.some((play) => play.id === selectedPlayId)) {
      setSelectedPlayId(newestPlayId(playbook))
    }
  }, [playbook.plays, selectedPlayId])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setNewPlayOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const notify = (text: string, kind: ToastMessage['kind'] = 'success') => {
    setToast({ id: Date.now(), kind, text })
  }

  const navigate = (next: View) => {
    if (next === 'design') {
      if (!selectedPlay) {
        if (playbook.plays.length) {
          setSelectedPlayId(playbook.plays[0].id)
        } else {
          setNewPlayOpen(true)
          return
        }
      }
    }
    setView(next)
  }

  const openPlay = (playId: string) => {
    setSelectedPlayId(playId)
    setView('design')
  }

  const createBlank = (name: string, team: string) => {
    createPlaybook(name, team)
    setSelectedPlayId(null)
    setView('plays')
    setNewPlaybookOpen(false)
    setLibraryOpen(false)
    notify(`Added “${name}” to your playbooks. Saved in this browser.`)
  }

  const switchPlaybook = (id: string) => {
    const target = playbooks.find((item) => item.id === id)
    if (!target || target.id === playbook.id) {
      setLibraryOpen(false)
      return
    }
    selectPlaybook(id)
    // Picked in the same update so the editor never flashes an empty play.
    setSelectedPlayId(newestPlayId(target))
    setLibraryOpen(false)
    notify(`Editing “${target.name}”.`)
  }

  const pickImportFile = () => fileInputRef.current?.click()

  const handleImportFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith('.pbc')) {
        notify('Importing .pbc files is not supported yet. Use the Snapbook JSON backup.', 'error')
        return
      }
      const imported = await importNative(file)
      setPendingImport({ fileName: file.name, playbook: imported })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import that file.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader
        view={view}
        onView={navigate}
        playbookName={playbook.name}
        playbookCount={playbooks.length}
        onLibrary={() => setLibraryOpen(true)}
        onNewPlay={() => setNewPlayOpen(true)}
        onExportPdf={() => {
          if (!selectedPlay) {
            notify('Add a play first, then build your wrist coach.', 'error')
            return
          }
          setView('wrist')
        }}
        onExportRouteTree={() => setView('tree')}
        onExportPbc={() => setPbcOpen(true)}
        onExportNative={() => {
          exportNative(playbook)
          notify('Snapbook backup downloaded.')
        }}
        onImport={pickImportFile}
        onShare={() => setShareOpen(true)}
        onSync={() => setSyncOpen(true)}
        syncPhase={cloud.state.phase}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.snapbook,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleImportFile(file)
          event.target.value = ''
        }}
      />

      {view === 'plays' && (
        <PlaysView
          onOpenPlay={openPlay}
          onNewPlay={() => setNewPlayOpen(true)}
          onNewPlaybook={() => setNewPlaybookOpen(true)}
          onConfigure={() => setView('team')}
        />
      )}

      {view === 'design' &&
        (selectedPlay ? (
          <DesignView play={selectedPlay} onBack={() => setView('plays')} />
        ) : (
          <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink-850 text-fog">
              <Plus size={22} />
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold text-chalk">
              No play selected
            </h1>
            <p className="mt-1 text-sm text-fog">
              Pick a play from the playbook or create a new one.
            </p>
            <button className="btn btn-primary mt-5" onClick={() => setNewPlayOpen(true)}>
              <Plus size={15} />
              New play
            </button>
          </div>
        ))}

      {view === 'wrist' && <WristCoachView onBack={() => setView('plays')} />}

      {view === 'tree' && <RouteTreeView />}

      {view === 'team' && <TeamView />}

      <SiteFooter className="mx-auto mt-2 max-w-[1500px] px-4 pb-10 sm:px-6 lg:px-8" />

      <NewPlayDialog
        open={newPlayOpen}
        onClose={() => setNewPlayOpen(false)}
        onCreate={(playId) => {
          setSelectedPlayId(playId)
          setView('design')
          setNewPlayOpen(false)
        }}
      />

      <NewPlaybookDialog
        open={newPlaybookOpen}
        onClose={() => setNewPlaybookOpen(false)}
        onCreate={createBlank}
        onImport={() => {
          setNewPlaybookOpen(false)
          pickImportFile()
        }}
        onBackup={() => {
          exportNative(playbook)
          notify('Snapbook backup downloaded.')
        }}
      />

      <PlaybookLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        playbooks={playbooks}
        activeId={playbook.id}
        syncConnected={cloud.state.phase === 'connected'}
        onSelect={switchPlaybook}
        onDuplicate={(id) => {
          const source = playbooks.find((item) => item.id === id)
          if (!source || !duplicatePlaybook(id)) return
          setSelectedPlayId(null)
          notify(`Duplicated “${source.name}”.`)
        }}
        onDelete={(id) => {
          const source = playbooks.find((item) => item.id === id)
          deletePlaybook(id)
          const remaining = usePlaybook.getState()
          setSelectedPlayId(newestPlayId(selectActivePlaybook(remaining)))
          notify(`Deleted “${source?.name ?? 'that playbook'}”.`)
        }}
        onNew={() => {
          setLibraryOpen(false)
          setNewPlaybookOpen(true)
        }}
        onImport={() => {
          setLibraryOpen(false)
          pickImportFile()
        }}
        onSync={() => {
          setLibraryOpen(false)
          setSyncOpen(true)
        }}
      />

      <PbcExportDialog
        open={pbcOpen}
        onClose={() => setPbcOpen(false)}
        playbook={playbook}
        onSuccess={(message) => notify(message)}
      />

      <ShareDialog
        open={shareOpen}
        playbook={playbook}
        onClose={() => setShareOpen(false)}
        onNotify={notify}
      />

      <SyncDialog
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        sync={cloud.state}
        onConnect={() => void cloud.connect()}
        onDisconnect={cloud.disconnect}
        onSyncNow={() => void cloud.syncNow()}
        onResolveConflict={(choice) => void cloud.resolveConflict(choice)}
        onExportBackup={() => {
          exportNative(playbook)
          notify('Snapbook backup downloaded.')
        }}
      />

      <Modal
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        title="Import this playbook?"
        description="It is added to your library as its own playbook. Nothing is replaced."
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!pendingImport) return
                addPlaybook(pendingImport.playbook)
                setSelectedPlayId(null)
                setView('plays')
                notify(
                  `Added “${pendingImport.playbook.name}” with ${pendingImport.playbook.plays.length} plays.`,
                )
                setPendingImport(null)
              }}
            >
              Add to library
            </button>
          </div>
        }
      >
        {pendingImport && (
          <div className="rounded-xl border border-line bg-ink-900 p-4">
            <p className="font-display text-lg font-bold text-chalk">
              {pendingImport.playbook.name}
            </p>
            <p className="mt-1 text-[0.76rem] text-fog">
              {pendingImport.playbook.plays.length} plays ·{' '}
              {pendingImport.playbook.formations.length} formations ·{' '}
              {pendingImport.playbook.categories.length} tags
            </p>
            <p className="mt-3 text-[0.7rem] text-slate-moss">{pendingImport.fileName}</p>
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
