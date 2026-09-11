import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { allowedOrigin } from '../lib/origins'
import { boundedBody, verifyRequest, RequestError } from '../lib/server-guards'
import { proxy } from '../proxy'

const host = 'https://mozhi.example'
function request(origin: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('origin', origin)
  return new NextRequest(`${host}/api/chat`, { ...init, signal: init.signal ?? undefined, headers })
}

test('only same-origin and exact Android local HTTPS origin are accepted', () => {
  for (const origin of [host, 'https://localhost']) {
    assert.equal(allowedOrigin(request(origin)), true)
    assert.doesNotThrow(() => verifyRequest(request(origin)))
  }
  for (const origin of ['https://evil.example', 'null', 'http://localhost', 'https://localhost.evil.example', 'not a URL', 'http://mozhi.example']) {
    assert.equal(allowedOrigin(request(origin)), false)
    assert.throws(() => verifyRequest(request(origin)), RequestError)
  }
  assert.throws(() => verifyRequest(new Request(`${host}/api/chat`)), RequestError)
})

test('Android JSON and binary audio preflights allow the exact required headers', () => {
  for (const path of ['/api/chat', '/api/transcribe', '/api/speech', '/api/capabilities']) {
    const response = proxy(new NextRequest(`${host}${path}`, { method: 'OPTIONS', headers: {
      origin: 'https://localhost', 'access-control-request-method': path.endsWith('capabilities') ? 'GET' : 'POST',
      'access-control-request-headers': 'content-type,x-input-language',
    } }))
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost')
    assert.equal(response.headers.get('access-control-allow-credentials'), null)
  }
})

test('untrusted preflights, methods, and extra headers are rejected', () => {
  for (const [origin, method, headers] of [['https://evil.example', 'POST', 'content-type'], ['null', 'POST', 'content-type'], ['https://localhost', 'DELETE', 'content-type'], ['https://localhost', 'POST', 'authorization']]) {
    const response = proxy(request(origin, { method: 'OPTIONS', headers: { 'access-control-request-method': method, 'access-control-request-headers': headers } }))
    assert.equal(response.status, 403)
  }
})

test('CORS passes actual response through without buffering and never caches it', () => {
  const response = proxy(request('https://localhost', { method: 'POST' }))
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.body, null)
})

test('body cap rejects both declared and streamed oversized requests', async () => {
  await assert.rejects(boundedBody(new Request(host, { method: 'POST', body: '123456', headers: { 'content-length': '6' } }), 5), RequestError)
  await assert.rejects(boundedBody(new Request(host, { method: 'POST', body: '123456' }), 5), RequestError)
  assert.equal((await boundedBody(new Request(host, { method: 'POST', body: '12345' }), 5)).length, 5)
})
