import { useEffect, useSyncExternalStore } from 'react'
import {
  applyServiceWorkerUpdate,
  dismissServiceWorkerUpdate,
  getServiceWorkerUpdateState,
  initializeServiceWorkerUpdates,
  subscribeServiceWorkerUpdates,
} from '../lib/swUpdates'

export function useServiceWorkerUpdate() {
  const state = useSyncExternalStore(
    subscribeServiceWorkerUpdates,
    getServiceWorkerUpdateState,
    getServiceWorkerUpdateState,
  )

  useEffect(() => {
    initializeServiceWorkerUpdates()
  }, [])

  return {
    state,
    apply: applyServiceWorkerUpdate,
    dismiss: dismissServiceWorkerUpdate,
  }
}
