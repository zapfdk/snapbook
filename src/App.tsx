import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppHeader, type View } from './components/AppHeader'
import { NewPlayDialog } from './components/NewPlayDialog'
import { NewPlaybookDialog } from './components/NewPlaybookDialog'
import { PbcExportDialog } from './components/PbcExportDialog'
import { Modal } from './components/Modal'
import { Toast, type ToastMessage } from './components/Toast'
import { PlaysView } from './views/PlaysView'
import { DesignView } from './views/DesignView'
import { WristCoachView } from './views/WristCoachView'
import { RouteTreeView } from './views/RouteTreeView'
import { TeamView } from './views/TeamView'
import { usePlaybook } from './store/playbook'
import { exportNative, importNative } from './lib/files'
import type { Playbook } from './types'

interface PendingImport {
  fileName: string
  playbook: Playbook
}

export default function App() {
  const playbook = usePlaybook((state) => state.playbook)
  const importPlaybook = usePlaybook((state) => state.importPlaybook)
  const createPlaybook = usePlaybook((state) => state.createPlaybook)

  const [view, setView] = useState<View>('plays')
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [newPlayOpen, setNewPlayOpen] = useState(false)
  const [newPlaybookOpen, setNewPlaybookOpen] = useState(false)
  const [pbcOpen, setPbcOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedPlay = playbook.plays.find((play) => play.id === selectedPlayId) ?? null

  useEffect(() => {
    if (!playbook.plays.length) {
      if (selectedPlayId) setSelectedPlayId(null)
      return
    }
    if (!selectedPlayId || !playbook.plays.some((play) => play.id === selectedPlayId)) {
      setSelectedPlayId(
        [...playbook.plays].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0].id,
      )
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
    notify(`Started “${name}”. Saved in this browser.`)
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

      <PbcExportDialog
        open={pbcOpen}
        onClose={() => setPbcOpen(false)}
        playbook={playbook}
        onSuccess={(message) => notify(message)}
      />

      <Modal
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        title="Replace this playbook?"
        description="Importing a backup replaces the playbook currently in this browser."
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setPendingImport(null)}>
              Keep current
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!pendingImport) return
                importPlaybook(pendingImport.playbook)
                setSelectedPlayId(pendingImport.playbook.plays[0]?.id ?? null)
                setView('plays')
                notify(
                  `Imported ${pendingImport.playbook.plays.length} plays from ${pendingImport.fileName}.`,
                )
                setPendingImport(null)
              }}
            >
              Import playbook
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
