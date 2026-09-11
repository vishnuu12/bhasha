import { generateSpeech } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import { errorResponse, readJson, RequestError, verifyRequest } from '@/lib/server-guards'

export const maxDuration = 60
const schema = z.object({ text: z.string().trim().min(1).max(6000), language: z.enum(['ta', 'en']), speed: z.number().min(0.75).max(1.25) })
export async function POST(request: Request) {
  try {
    verifyRequest(request)
    const parsed = schema.safeParse(await readJson(request, 30_000))
    if (!parsed.success) throw new RequestError('Speech input is invalid or too long.')
    const { audio } = await generateSpeech({
      model: gateway.speechModel('openai/tts-1-hd'),
      text: parsed.data.text,
      voice: 'nova',
      speed: parsed.data.speed,
      outputFormat: 'mp3',
      maxRetries: 0,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
    })
    return new Response(new Uint8Array(audio.uint8Array), { headers: { 'Content-Type': audio.mediaType, 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error, 'Cloud voice is unavailable for this request. Try an installed browser voice or read the text response.') }
}
