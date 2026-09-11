import { streamText } from 'ai'
import { z } from 'zod'
import { errorResponse, readJson, RequestError, verifyRequest } from '@/lib/server-guards'

export const maxDuration = 60
const schema = z.object({
  language: z.enum(['ta', 'en']),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(6000) })).min(1).max(20),
}).refine(value => value.messages.at(-1)?.role === 'user')

export async function POST(request: Request) {
  try {
    verifyRequest(request)
    const parsed = schema.safeParse(await readJson(request))
    if (!parsed.success) throw new RequestError('Use a shorter message and try again.')
    const { language, messages } = parsed.data
    const result = streamText({
      model: 'google/gemini-3.8-flash',
      instructions: `You are Mozhi, a warm, helpful voice assistant. Understand Tamil, English and Tanglish (Tamil written in Latin letters or mixed with English). Reply in ${language === 'ta' ? 'natural spoken Tamil using Tamil script' : 'English'}. Keep replies concise, usually 2–5 sentences, suitable for reading aloud. Use plain text without markdown, emoji or elaborate formatting. Be accurate and admit uncertainty. Do not claim you can access live information or perform actions without tools.`,
      messages,
      maxOutputTokens: 700,
      maxRetries: 1,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]),
    })
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') send({ text: part.text })
            if (part.type === 'error') { send({ error: 'The AI service could not complete the reply. Please try again.' }); controller.close(); return }
          }
          send({ done: true })
        } catch { send({ error: 'The reply was interrupted. Please try again.' }) }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error, 'AI chat is temporarily unavailable. Please try again shortly.') }
}
