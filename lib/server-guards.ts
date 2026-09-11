import { allowedOrigin } from './origins'

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function verifyRequest(request: Request) {
  if (!allowedOrigin(request)) throw new RequestError('This request must come from the app.', 403)
}

export async function boundedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestError('This request is too large.', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError('An input is required.')
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) { await reader.cancel(); throw new RequestError('This request is too large.', 413) }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export async function readJson(request: Request, maxBytes = 60_000): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new RequestError('Expected a JSON request.', 415)
  try { return JSON.parse((await boundedBody(request, maxBytes)).toString('utf8')) }
  catch (error) { if (error instanceof RequestError) throw error; throw new RequestError('Invalid JSON input.') }
}

export function errorResponse(error: unknown, fallback: string) {
  return Response.json({ error: error instanceof RequestError ? error.message : fallback }, {
    status: error instanceof RequestError ? error.status : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
