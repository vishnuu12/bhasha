const CACHE_NAME = __CACHE_NAME__
const SHELL = __SHELL_FILES__
const SHELL_PATHS = new Set(SHELL)

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))
  })())
  // Do not skipWaiting: activating mid-conversation would mix app versions.
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('mozhi-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  // No API, POST, RSC, cross-origin, recording, or conversation caching.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.search || request.headers.has('RSC')) return
  if (url.pathname === '/' && request.mode !== 'navigate') return
  if (!SHELL_PATHS.has(url.pathname)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(url.pathname)) || fetch(request)
  })())
})
