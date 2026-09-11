import { NextResponse, type NextRequest } from 'next/server'
import { allowedOrigin, ANDROID_ORIGIN } from '@/lib/origins'

const apiPaths = new Set(['/api/chat', '/api/transcribe', '/api/speech', '/api/capabilities'])
const requestHeaders = new Set(['content-type', 'x-input-language'])

export function proxy(request: NextRequest) {
  if (!apiPaths.has(request.nextUrl.pathname)) return NextResponse.next()
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigin(request)) {
    return NextResponse.json({ error: 'This origin is not allowed.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const cors = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' })
  if (origin === ANDROID_ORIGIN) cors.set('Access-Control-Allow-Origin', ANDROID_ORIGIN)
  if (request.method === 'OPTIONS') {
    const method = request.headers.get('access-control-request-method')
    const expectedMethod = request.nextUrl.pathname === '/api/capabilities' ? 'GET' : 'POST'
    const headers = (request.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
    if (!origin || !allowedOrigin(request) || method !== expectedMethod || headers.some(header => !requestHeaders.has(header))) {
      return new NextResponse(null, { status: 403, headers: cors })
    }
    cors.set('Access-Control-Allow-Methods', `${expectedMethod}, OPTIONS`)
    cors.set('Access-Control-Allow-Headers', 'Content-Type, X-Input-Language')
    cors.set('Access-Control-Max-Age', '600')
    return new NextResponse(null, { status: 204, headers: cors })
  }
  // Attach headers without reading or buffering the NDJSON/audio response body.
  return NextResponse.next({ headers: cors })
}

export const config = { matcher: '/api/:path*' }
