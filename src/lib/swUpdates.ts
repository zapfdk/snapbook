/**
 * Registers the offline worker and reports when a newer build is waiting.
 *
 * The worker never takes over a page on its own: a new version installs and
 * waits, the app shows a prompt, and only the user's reload activates it. That
 * keeps an open playbook from being swapped out mid-edit, while still making it
 * obvious that a new build exists.
 */

export interface ServiceWorkerUpdateState {
  ready: boolean
}

type Listener = () => void

const listeners = new Set<Listener>()
let state: ServiceWorkerUpdateState = { ready: false }
let registration: ServiceWorkerRegistration | null = null
let waiting: ServiceWorker | null = null
let initialized = false
let dismissed = false
let reloading = false
let lastCheck = 0

const CHECK_INTERVAL_MS = 60_000

function emit() {
  for (const listener of listeners) listener()
}

function setReady(ready: boolean) {
  if (state.ready === ready) return
  state = { ready }
  emit()
}

export function getServiceWorkerUpdateState(): ServiceWorkerUpdateState {
  return state
}

export function subscribeServiceWorkerUpdates(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function reportWaiting(worker: ServiceWorker | null) {
  if (!worker) return
  waiting = worker
  // A worker that was already waiting when the page loaded is an update too,
  // unless the user dismissed it earlier in this session.
  if (dismissed) return
  setReady(true)
}

function watchWorker(worker: ServiceWorker | null) {
  if (!worker) return
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return
    // With no controller this is the first install, not an update.
    if (!navigator.serviceWorker.controller) return
    dismissed = false
    reportWaiting(registration?.waiting ?? worker)
  })
}

function checkForUpdate() {
  if (!registration) return
  const now = Date.now()
  if (now - lastCheck < CHECK_INTERVAL_MS) return
  lastCheck = now
  void registration.update().catch(() => {
    // Offline or a transient network failure; the next check will retry.
  })
}

export function initializeServiceWorkerUpdates(): void {
  if (initialized) return
  initialized = true
  if (import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const container = navigator.serviceWorker

  container.addEventListener('controllerchange', () => {
    // Only reload for an update the user asked for; the first install must not
    // reload the page under them.
    if (!reloading) return
    window.location.reload()
  })

  const register = async () => {
    try {
      const registered = await container.register(new URL('sw.js', document.baseURI), {
        updateViaCache: 'none',
      })
      registration = registered
      reportWaiting(registered.waiting)
      watchWorker(registered.installing)
      registered.addEventListener('updatefound', () => {
        watchWorker(registered.installing)
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setTimeout(checkForUpdate, 3_000)
    } catch (error) {
      console.warn('[snapbook] service worker registration failed', error)
    }
  }

  void register()
}

/** Switches to the waiting build and reloads once it controls the page. */
export function applyServiceWorkerUpdate(): void {
  const worker = waiting ?? registration?.waiting ?? null
  if (!worker) {
    window.location.reload()
    return
  }
  reloading = true
  worker.postMessage({ type: 'SKIP_WAITING' })
}

/** Hides the prompt until a different build arrives or the app restarts. */
export function dismissServiceWorkerUpdate(): void {
  dismissed = true
  setReady(false)
}
