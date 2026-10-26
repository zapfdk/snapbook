import { activePlaybook, usePlaybook } from '../store/playbook'
import type { Playbook } from '../types'
import {
  applyMergeChoice,
  baselineHash,
  libraryHash,
  mergeLibraries,
  parseLibrary,
  serializeLibrary,
  type LibraryMerge,
} from './library'
import { playbookHash } from './syncLogic'
import {
  DropboxApiError,
  DropboxAuthError,
  DropboxConflictError,
  buildAuthorizeUrl,
  createDropboxClient,
  createPkcePair,
  dropboxRedirectUri,
  exchangeDropboxCode,
  getDropboxAppKey,
  parseDropboxCallback,
  randomToken,
  refreshDropboxToken,
  type DropboxAccount,
  type DropboxFileMetadata,
  type DropboxToken,
} from './dropbox'

const CONNECTION_KEY = 'snapbook.cloud.dropbox.v1'
const ACCESS_KEY = 'snapbook.cloud.dropbox.access.v1'
const PENDING_KEY = 'snapbook.cloud.dropbox.pending.v1'
const AUTO_SYNC_DELAY = 1500
const FOCUS_SYNC_INTERVAL = 30_000
const AUTH_WINDOW = 15 * 60_000

interface StoredConnection {
  version: 2
  refreshToken: string
  accountLabel: string
  accountId: string | null
  remoteRev: string | null
  lastSyncedAt: string | null
  /** Playbook id → content hash at the last successful sync. */
  baseline: Record<string, string>
}

interface StoredAccess {
  token: string
  expiresAt: number
}

interface PendingAuth {
  verifier: string
  state: string
  redirectUri: string
  createdAt: number
}

export interface CloudConflictItem {
  name: string
  localPlays: number
  remotePlays: number
}

export interface CloudConflict {
  items: CloudConflictItem[]
}

export type CloudSyncPhase =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'conflict'
  | 'error'

export interface CloudSyncState {
  configured: boolean
  phase: CloudSyncPhase
  accountLabel: string | null
  lastSyncedAt: string | null
  error: string | null
  conflict: CloudConflict | null
}

type Listener = () => void

const listeners = new Set<Listener>()
let snapshot: CloudSyncState = {
  configured: Boolean(getDropboxAppKey()),
  phase: 'disconnected',
  accountLabel: null,
  lastSyncedAt: null,
  error: null,
  conflict: null,
}

let connection: StoredConnection | null = null
let access: StoredAccess | null = null
let pendingAuth: PendingAuth | null = null
let pendingMerge: { merge: LibraryMerge; remoteRev: string } | null = null
let initialized = false
let ready = false
let applyingRemote = false
let storeSubscribed = false
let lifecycleInstalled = false
let autoTimer: ReturnType<typeof setTimeout> | null = null
let lastFocusSync = 0
let syncInFlight: Promise<void> | null = null

function setState(patch: Partial<CloudSyncState>) {
  snapshot = { ...snapshot, ...patch }
  for (const listener of listeners) listener()
}

function localStorageOrNull(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

function readStored<T>(storage: Storage | null, key: string): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeStored(storage: Storage | null, key: string, value: unknown) {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // A full or blocked storage area should not break the editor.
  }
}

function removeStored(storage: Storage | null, key: string) {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Ignore blocked storage.
  }
}

function readConnection(): StoredConnection | null {
  const value = readStored<Record<string, unknown>>(localStorageOrNull(), CONNECTION_KEY)
  if (!value || typeof value.refreshToken !== 'string' || !value.refreshToken) return null

  const baseline: Record<string, string> = {}
  if (value.baseline && typeof value.baseline === 'object' && !Array.isArray(value.baseline)) {
    for (const [id, hash] of Object.entries(value.baseline as Record<string, unknown>)) {
      if (typeof hash === 'string') baseline[id] = hash
    }
  }

  return {
    version: 2,
    refreshToken: value.refreshToken,
    accountLabel:
      typeof value.accountLabel === 'string' && value.accountLabel.trim()
        ? value.accountLabel.trim()
        : 'Dropbox',
    accountId: typeof value.accountId === 'string' ? value.accountId : null,
    remoteRev: typeof value.remoteRev === 'string' ? value.remoteRev : null,
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    baseline,
  }
}

function saveConnection(next: StoredConnection | null) {
  connection = next
  if (next) writeStored(localStorageOrNull(), CONNECTION_KEY, next)
  else removeStored(localStorageOrNull(), CONNECTION_KEY)
}

function updateConnection(patch: Partial<StoredConnection>) {
  if (!connection) return
  saveConnection({ ...connection, ...patch })
}

function readAccess(): StoredAccess | null {
  const value = readStored<Record<string, unknown>>(sessionStorageOrNull(), ACCESS_KEY)
  if (!value || typeof value.token !== 'string' || typeof value.expiresAt !== 'number') {
    return null
  }
  return { token: value.token, expiresAt: value.expiresAt }
}

function saveAccess(next: StoredAccess) {
  access = next
  writeStored(sessionStorageOrNull(), ACCESS_KEY, next)
}

function clearAccess() {
  access = null
  removeStored(sessionStorageOrNull(), ACCESS_KEY)
}

function readPendingAuth(): PendingAuth | null {
  pendingAuth = readStored<PendingAuth>(sessionStorageOrNull(), PENDING_KEY)
  return pendingAuth
}

function savePendingAuth(next: PendingAuth | null) {
  pendingAuth = next
  if (next) writeStored(sessionStorageOrNull(), PENDING_KEY, next)
  else removeStored(sessionStorageOrNull(), PENDING_KEY)
}

function nowIso(): string {
  return new Date().toISOString()
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Cloud sync failed. Your playbooks are safe in this browser.'
}

function clearOAuthQuery() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  for (const key of ['code', 'state', 'error', 'error_description', 'error_uri']) {
    url.searchParams.delete(key)
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

async function getAccessToken(force = false): Promise<string> {
  const freshEnough = (value: StoredAccess | null) =>
    Boolean(value && value.expiresAt - 60_000 > Date.now())

  if (!force) {
    if (freshEnough(access)) return access!.token
    const stored = readAccess()
    if (freshEnough(stored)) {
      access = stored
      return stored!.token
    }
  }

  if (!connection?.refreshToken) {
    throw new DropboxAuthError('Reconnect Dropbox to continue syncing.')
  }

  let token: DropboxToken
  try {
    token = await refreshDropboxToken({
      clientId: getDropboxAppKey(),
      refreshToken: connection.refreshToken,
    })
  } catch (error) {
    if (
      error instanceof DropboxApiError &&
      (error.status === 401 ||
        error.tag === 'invalid_grant' ||
        error.summary.includes('invalid_grant'))
    ) {
      throw new DropboxAuthError('Dropbox needs you to reconnect. Your playbooks are safe.')
    }
    throw error
  }
  saveAccess({
    token: token.accessToken,
    expiresAt: Date.now() + token.expiresIn * 1000,
  })
  if (token.refreshToken) updateConnection({ refreshToken: token.refreshToken })
  return token.accessToken
}

async function withDropbox<T>(
  action: (client: ReturnType<typeof createDropboxClient>) => Promise<T>,
): Promise<T> {
  const token = await getAccessToken()
  try {
    return await action(createDropboxClient(token))
  } catch (error) {
    if (error instanceof DropboxAuthError) {
      clearAccess()
      const retryToken = await getAccessToken(true)
      return action(createDropboxClient(retryToken))
    }
    throw error
  }
}

const playKey = (play: Playbook['plays'][number]) =>
  `${play.name}${String.fromCharCode(0)}${play.codeName}`

/**
 * Replaces the library with a merged or downloaded one. Play ids are local to
 * a device and are regenerated when a file is parsed, so the wrist-coach
 * selection is carried over by play name and code.
 */
function applyLibrary(playbooks: Playbook[], activeId?: string) {
  applyingRemote = true
  try {
    const state = usePlaybook.getState()
    const before = activePlaybook(state)
    const previousSelection = state.wrist.selectedPlayIds
    state.replaceLibrary(playbooks, activeId)

    const after = activePlaybook(usePlaybook.getState())
    if (after.id !== before.id || !previousSelection.length) return

    const candidates = new Map<string, string[]>()
    for (const play of after.plays) {
      const key = playKey(play)
      candidates.set(key, [...(candidates.get(key) ?? []), play.id])
    }
    const selected = new Set(previousSelection)
    const next: string[] = []
    for (const previous of before.plays) {
      if (!selected.has(previous.id)) continue
      const match = candidates.get(playKey(previous))?.shift()
      if (match) next.push(match)
    }
    if (next.length) state.setWristPlays(next)
  } finally {
    applyingRemote = false
  }
}

async function readRemoteLibrary(): Promise<{
  rev: string
  playbooks: Playbook[]
  legacy: boolean
} | null> {
  const metadata = await withDropbox((client) => client.getMetadata())
  if (!metadata) return null
  const text = await withDropbox((client) => client.download())
  try {
    const parsed = parseLibrary(text)
    return { rev: metadata.rev, playbooks: parsed.playbooks, legacy: parsed.legacy }
  } catch (error) {
    throw new Error(
      `The Dropbox copy could not be read${error instanceof Error ? `: ${error.message}` : '.'}`,
    )
  }
}

function recordSynced(playbooks: Playbook[], remoteRev: string) {
  if (!connection) return
  const baseline = Object.fromEntries(
    playbooks.map((playbook) => [playbook.id, playbookHash(playbook)]),
  )
  const syncedAt = nowIso()
  updateConnection({ remoteRev, lastSyncedAt: syncedAt, baseline })
  setState({ phase: 'connected', lastSyncedAt: syncedAt, error: null, conflict: null })
}

function enterConflict(merge: LibraryMerge, remoteRev: string) {
  pendingMerge = { merge, remoteRev }
  setState({
    phase: 'conflict',
    conflict: {
      items: merge.conflicts.map((conflict) => ({
        name: conflict.local.name,
        localPlays: conflict.local.plays.length,
        remotePlays: conflict.remote.plays.length,
      })),
    },
    error: null,
  })
}

async function uploadLibrary(playbooks: Playbook[], rev: string | null): Promise<void> {
  const text = serializeLibrary(playbooks)
  let metadata: DropboxFileMetadata
  try {
    metadata = await withDropbox((client) => client.upload(text, { rev }))
  } catch (error) {
    if (error instanceof DropboxConflictError) {
      const remote = await readRemoteLibrary()
      if (remote) {
        enterConflict(
          mergeLibraries({
            local: playbooks,
            remote: remote.playbooks,
            baseline: connection?.baseline ?? {},
          }),
          remote.rev,
        )
        return
      }
      metadata = await withDropbox((client) => client.upload(text, { rev: null }))
    } else {
      throw error
    }
  }
  recordSynced(playbooks, metadata.rev)
}

async function runSync(): Promise<void> {
  if (!connection) {
    setState({ phase: 'disconnected', error: null, conflict: null })
    return
  }
  if (snapshot.phase === 'conflict') return

  setState({ phase: 'syncing', error: null })
  try {
    const local = usePlaybook.getState().playbooks
    const metadata = await withDropbox((client) => client.getMetadata())
    if (!connection) return

    if (!metadata) {
      await uploadLibrary(local, null)
      return
    }

    const unchangedLocally =
      libraryHash(local) === baselineHash(connection.baseline) &&
      metadata.rev === connection.remoteRev
    if (unchangedLocally) {
      setState({
        phase: 'connected',
        lastSyncedAt: connection.lastSyncedAt,
        error: null,
        conflict: null,
      })
      return
    }

    const remote = await readRemoteLibrary()
    if (!remote) {
      await uploadLibrary(local, null)
      return
    }

    let remotePlaybooks = remote.playbooks
    if (remote.legacy && local.length === 1) {
      // The file predates the library: it is this browser's one playbook.
      remotePlaybooks = [{ ...remote.playbooks[0], id: local[0].id }]
    }

    const merge = mergeLibraries({
      local,
      remote: remotePlaybooks,
      baseline: connection.baseline,
    })
    if (merge.conflicts.length) {
      enterConflict(merge, remote.rev)
      return
    }

    const merged = merge.playbooks
    const mergedHash = libraryHash(merged)

    if (mergedHash !== libraryHash(local)) {
      applyLibrary(merged)
    }

    if (mergedHash === libraryHash(remotePlaybooks)) {
      // Dropbox already holds this exact library; only the baseline is new.
      recordSynced(merged, remote.rev)
      return
    }

    await uploadLibrary(merged, remote.rev)
  } catch (error) {
    if (error instanceof DropboxConflictError) {
      try {
        const remote = await readRemoteLibrary()
        if (remote) {
          enterConflict(
            mergeLibraries({
              local: usePlaybook.getState().playbooks,
              remote: remote.playbooks,
              baseline: connection?.baseline ?? {},
            }),
            remote.rev,
          )
          return
        }
      } catch {
        // Fall through to the original error below.
      }
    }
    if (error instanceof DropboxAuthError) {
      clearAccess()
      setState({
        phase: 'error',
        error: 'Dropbox needs you to reconnect. Your playbooks are safe.',
      })
      return
    }
    setState({ phase: 'error', error: errorMessage(error) })
  }
}

export function syncCloudNow(): Promise<void> {
  if (syncInFlight) return syncInFlight
  syncInFlight = runSync().finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

function scheduleAutoSync() {
  if (!connection || snapshot.phase === 'conflict' || snapshot.phase === 'error') return
  if (autoTimer) clearTimeout(autoTimer)
  autoTimer = setTimeout(() => {
    autoTimer = null
    if (!connection || snapshot.phase === 'conflict' || snapshot.phase === 'error') return
    void syncCloudNow().finally(() => {
      if (
        connection &&
        snapshot.phase === 'connected' &&
        libraryHash(usePlaybook.getState().playbooks) !== baselineHash(connection.baseline)
      ) {
        scheduleAutoSync()
      }
    })
  }, AUTO_SYNC_DELAY)
}

function subscribeToStore() {
  if (storeSubscribed) return
  storeSubscribed = true
  usePlaybook.subscribe((state, previous) => {
    if (!ready || applyingRemote || !connection) return
    if (state.playbooks !== previous.playbooks) scheduleAutoSync()
  })
}

function installLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') return
  lifecycleInstalled = true
  const checkRemote = () => {
    if (!ready || !connection) return
    if (Date.now() - lastFocusSync < FOCUS_SYNC_INTERVAL) return
    lastFocusSync = Date.now()
    void syncCloudNow()
  }
  window.addEventListener('focus', checkRemote)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkRemote()
  })
}

async function completeAuth(
  callback: NonNullable<ReturnType<typeof parseDropboxCallback>>,
  appKey: string,
) {
  const pending = readPendingAuth()
  clearOAuthQuery()

  if ('error' in callback) {
    savePendingAuth(null)
    setState({ phase: connection ? 'connected' : 'disconnected', error: callback.error })
    return
  }
  if (
    !pending ||
    !pending.state ||
    pending.state !== callback.state ||
    Date.now() - pending.createdAt > AUTH_WINDOW
  ) {
    savePendingAuth(null)
    setState({
      phase: 'error',
      error: 'That Dropbox sign-in link is no longer valid. Start the connection again.',
    })
    return
  }

  savePendingAuth(null)
  setState({ phase: 'connecting', error: null })

  try {
    const token = await exchangeDropboxCode({
      clientId: appKey,
      code: callback.code,
      redirectUri: pending.redirectUri,
      codeVerifier: pending.verifier,
    })
    saveAccess({
      token: token.accessToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
    })

    let account: DropboxAccount | null = null
    try {
      account = await createDropboxClient(token.accessToken).getAccount()
    } catch {
      // The file APIs can still work if the profile endpoint is unavailable.
    }

    const previous = connection
    const accountId = account?.accountId ?? token.accountId ?? null
    const sameAccount = Boolean(
      previous && (!accountId || !previous.accountId || accountId === previous.accountId),
    )
    saveConnection({
      version: 2,
      refreshToken: token.refreshToken ?? previous?.refreshToken ?? '',
      accountLabel: account?.displayName ?? previous?.accountLabel ?? 'Dropbox',
      accountId,
      remoteRev: sameAccount ? (previous?.remoteRev ?? null) : null,
      lastSyncedAt: sameAccount ? (previous?.lastSyncedAt ?? null) : null,
      baseline: sameAccount ? (previous?.baseline ?? {}) : {},
    })
    setState({
      phase: 'syncing',
      accountLabel: account?.displayName ?? previous?.accountLabel ?? 'Dropbox',
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      error: null,
      conflict: null,
    })
    await runSync()
  } catch (error) {
    setState({ phase: 'error', error: errorMessage(error) })
  } finally {
    ready = true
  }
}

export function initializeCloudSync(): Promise<void> {
  if (initialized) return Promise.resolve()
  initialized = true
  const appKey = getDropboxAppKey()
  const stored = readConnection()
  connection = stored
  access = readAccess()
  subscribeToStore()
  installLifecycle()

  setState({
    configured: Boolean(appKey),
    accountLabel: stored?.accountLabel ?? null,
    lastSyncedAt: stored?.lastSyncedAt ?? null,
    phase: stored ? 'syncing' : 'disconnected',
    error: null,
    conflict: null,
  })

  return (async () => {
    if (!appKey) {
      if (stored) {
        setState({
          phase: 'error',
          error:
            'Dropbox sync is not configured in this build. Add VITE_DROPBOX_APP_KEY and rebuild.',
        })
      }
      ready = true
      return
    }

    const callback =
      typeof window !== 'undefined' ? parseDropboxCallback(window.location.search) : null
    if (callback) {
      try {
        await completeAuth(callback, appKey)
      } finally {
        ready = true
      }
      return
    }

    if (!stored) {
      ready = true
      return
    }

    try {
      await runSync()
    } finally {
      ready = true
    }
  })()
}

export async function connectDropbox(): Promise<void> {
  const appKey = getDropboxAppKey()
  if (!appKey) {
    setState({
      configured: false,
      phase: 'error',
      error:
        'Dropbox sync is not configured in this build. Add VITE_DROPBOX_APP_KEY and rebuild.',
    })
    return
  }
  setState({ phase: 'connecting', error: null, conflict: null })
  try {
    const redirectUri = dropboxRedirectUri()
    const { verifier, challenge } = await createPkcePair()
    const state = randomToken(16)
    savePendingAuth({
      verifier,
      state,
      redirectUri,
      createdAt: Date.now(),
    })
    window.location.assign(
      buildAuthorizeUrl({
        clientId: appKey,
        redirectUri,
        state,
        codeChallenge: challenge,
      }),
    )
  } catch (error) {
    setState({ phase: 'error', error: errorMessage(error) })
  }
}

export function disconnectDropbox() {
  const token = access?.token
  if (token) {
    void createDropboxClient(token)
      .revoke()
      .catch(() => {
        // Disconnecting locally is enough if the token already expired.
      })
  }
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
  pendingMerge = null
  saveConnection(null)
  clearAccess()
  savePendingAuth(null)
  setState({
    phase: 'disconnected',
    accountLabel: null,
    lastSyncedAt: null,
    error: null,
    conflict: null,
  })
}

export async function resolveCloudConflict(choice: 'local' | 'remote'): Promise<void> {
  const pending = pendingMerge
  if (!pending || !connection) return
  if (syncInFlight) await syncInFlight

  setState({ phase: 'syncing', error: null })
  try {
    const resolved = applyMergeChoice(pending.merge, choice)
    pendingMerge = null
    applyLibrary(resolved)
    await uploadLibrary(resolved, pending.remoteRev)
  } catch (error) {
    if (error instanceof DropboxConflictError) {
      try {
        const remote = await readRemoteLibrary()
        if (remote) {
          enterConflict(
            mergeLibraries({
              local: usePlaybook.getState().playbooks,
              remote: remote.playbooks,
              baseline: connection?.baseline ?? {},
            }),
            remote.rev,
          )
          return
        }
      } catch {
        // Fall through to the error below.
      }
    }
    setState({ phase: 'error', error: errorMessage(error) })
  }
}

export function getCloudSyncState(): CloudSyncState {
  return snapshot
}

export function subscribeCloudSync(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
