import { useEffect, useSyncExternalStore } from 'react'
import {
  connectDropbox,
  disconnectDropbox,
  getCloudSyncState,
  initializeCloudSync,
  resolveCloudConflict,
  subscribeCloudSync,
  syncCloudNow,
} from '../lib/cloudSync'

export function useCloudSync() {
  const state = useSyncExternalStore(
    subscribeCloudSync,
    getCloudSyncState,
    getCloudSyncState,
  )

  useEffect(() => {
    void initializeCloudSync()
  }, [])

  return {
    state,
    connect: connectDropbox,
    disconnect: disconnectDropbox,
    syncNow: syncCloudNow,
    resolveConflict: resolveCloudConflict,
  }
}
