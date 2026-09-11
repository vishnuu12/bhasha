import { transcribe } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { boundedBody, errorResponse, RequestError, verifyRequest } from '@/lib/server-guards'

export const maxDuration = 60
export async function POST(request: Request) {
  try {
    verifyRequest(request)
    const type = request.headers.get('content-type')?.split(';')[0]
    if (!type || !['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'].includes(type)) throw new RequestError('This audio format is not supported.', 415)
    const language = request.headers.get('x-input-language')
    if (!['ta', 'en', 'mix'].includes(language ?? '')) throw new RequestError('Choose an input language.')
    const audio = await boundedBody(request, 3_000_000)
    if (audio.length < 100) throw new RequestError('No audio was captured. Please record again.')
    const result = await transcribe({
      model: gateway.transcriptionModel('openai/gpt-4o-transcribe'),
      audio,
      providerOptions: { openai: { ...(language !== 'mix' ? { language } : {}), prompt: 'The speaker uses Tamil, English, or mixed Tamil and English. Transcribe faithfully.' } },
      maxRetries: 0,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
    })
    if (!result.text.trim()) throw new RequestError('No speech was detected. Please try again.')
    return Response.json({ text: result.text.slice(0, 3000) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error, 'Cloud transcription is unavailable for this request. Try Browser speech in Voice settings and record again, or type your message.') }
}
