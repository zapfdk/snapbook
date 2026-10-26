import { createSnapbookFile } from './files'
import type { Playbook } from '../types'

const FIXED_EXPORT_TIME = '2000-01-01T00:00:00.000Z'

/**
 * A stable fingerprint of the playbook's actual coaching content. Local ids,
 * timestamps and generated object keys are deliberately ignored so that two
 * devices holding the same playbook still compare equal after one of them
 * reads it back from a file. It is used to tell whether this browser has edits
 * that Dropbox has not seen yet.
 */
export function playbookHash(playbook: Playbook): string {
  try {
    const file = createSnapbookFile(playbook, FIXED_EXPORT_TIME).playbook
    return JSON.stringify({
      ...file,
      plays: file.plays.map(({ updatedAt, ...play }) => play),
    })
  } catch {
    // The editor should never hold an invalid playbook, but a hash must not
    // stop local saving or sync from reporting a useful error.
    return JSON.stringify(playbook)
  }
}

export type CloudSyncPlan = 'upload' | 'download' | 'up-to-date' | 'compare'

/**
 * Decide what a sync pass should do without touching the network. When both
 * sides changed since the last successful sync the file contents have to be
 * compared before choosing between adopting the remote copy and a conflict.
 */
export function planCloudSync({
  remoteExists,
  remoteRev,
  localHash,
  syncedRev,
  syncedHash,
}: {
  remoteExists: boolean
  remoteRev: string | null
  localHash: string
  syncedRev: string | null
  syncedHash: string | null
}): CloudSyncPlan {
  if (!remoteExists) return 'upload'

  const remoteChanged = remoteRev !== syncedRev
  const localChanged = localHash !== syncedHash

  if (!localChanged && !remoteChanged) return 'up-to-date'
  if (!localChanged) return 'download'
  if (!remoteChanged) return 'upload'
  return 'compare'
}
