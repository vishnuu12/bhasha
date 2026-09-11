import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function worker() {
  const events = new Map<string, (event: any) => void>()
  const source = readFileSync('scripts/service-worker.js', 'utf8').replace('__CACHE_NAME__', '"mozhi-shell-test"').replace('__SHELL_FILES__', '["/", "/icons/mozhi-192.png", "/_next/static/app.js"]')
  vm.runInNewContext(source, {
    URL, Request, Set,
    self: { location: { origin: 'https://mozhi.example' }, addEventListener: (name: string, callback: (event: any) => void) => events.set(name, callback) },
    caches: { open: async () => ({ match: async () => new Response('cached shell') }) },
  })
  return events
}

test('service worker never intercepts API, POST, cross-origin, RSC, or query requests', () => {
  const onFetch = worker().get('fetch')!
  for (const [url, method, headers] of [
    ['https://mozhi.example/api/chat', 'POST', {}],
    ['https://mozhi.example/api/capabilities', 'GET', {}],
    ['https://backend.example/api/speech', 'POST', {}],
    ['https://mozhi.example/?_rsc=abc', 'GET', {}],
    ['https://mozhi.example/', 'GET', { RSC: '1' }],
    ['https://mozhi.example/_next/static/app.js', 'POST', {}],
  ] as const) {
    let intercepted = false
    onFetch({ request: { url, method, headers: new Headers(headers), mode: 'navigate' }, respondWith: () => { intercepted = true } })
    assert.equal(intercepted, false, `${method} ${url}`)
  }
})

test('service worker serves only explicit shell paths for offline navigation/assets', async () => {
  const onFetch = worker().get('fetch')!
  for (const pathname of ['/', '/icons/mozhi-192.png', '/_next/static/app.js']) {
    let response: Promise<Response> | undefined
    onFetch({ request: { url: `https://mozhi.example${pathname}`, method: 'GET', headers: new Headers(), mode: 'navigate' }, respondWith: (value: Promise<Response>) => { response = value } })
    assert.ok(response)
    assert.equal(await (await response).text(), 'cached shell')
  }
})
