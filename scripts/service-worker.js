/*
 * Snapbook service worker.
 *
 * This file is a template: scripts/build-service-worker.mjs copies it to
 * dist/sw.js and fills in the build version and the exact list of files for
 * that build. The cache name carries the version, so a new deployment always
 * installs a new worker with a fresh cache, and the old cache is dropped once
 * the user accepts the update.
 *
 * Strategy:
 *  - navigations are cache-first so the installed app opens instantly and
 *    works with no signal; the shell is only replaced when the user reloads
 *    into an accepted update
 *  - everything else is cache-first with a network fallback, and is written
 *    into the current cache when it is not there yet
 *  - cross-origin requests (Dropbox's API) are never intercepted
 */

const VERSION = '__SNAPBUILD_VERSION__'
const PRECACHE = __SNAPBUILD_PRECACHE__

const CACHE_PREFIX = 'snapbook-'
const CACHE = `${CACHE_PREFIX}${VERSION}`
const SHELL = new URL('index.html', self.registration.scope).href

self.addEventListener('install', (event) => {
  // No skipWaiting here: the new worker waits until the page asks for it, so a
  // reload never swaps the app out from under an open session.
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Dropbox and anything else off-origin must stay between the page and that
  // service; caching or rewriting those responses would break sync and auth.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  event.respondWith(handleAsset(request))
})

async function precache() {
  const cache = await caches.open(CACHE)
  await Promise.all(
    PRECACHE.map(async (path) => {
      const url = new URL(path, self.registration.scope).href
      try {
        // bypass the HTTP cache so a fresh deployment is never precached from
        // a stale copy of index.html
        const response = await fetch(new Request(url, { cache: 'reload' }))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await cache.put(url, response)
      } catch (error) {
        console.warn('[snapbook/sw] could not precache', path, error)
      }
    }),
  )
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE)
  // ignoreSearch keeps the OAuth return (?code=…&state=…) and any other query
  // on the same document working: the shell is served, the URL is untouched.
  const hit = await cache.match(request, { ignoreSearch: true })
  if (hit) return hit

  const shell = await cache.match(SHELL)
  if (shell) return shell

  return fetch(request)
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit

  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      void cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch (error) {
    const fallback = await cache.match(request.url, { ignoreSearch: true })
    if (fallback) return fallback
    throw error
  }
}
