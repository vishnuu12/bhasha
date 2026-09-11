import { gateway } from '@ai-sdk/gateway'

export async function GET() {
  try {
    const catalogue = await gateway.getAvailableModels()
    const models = new Set(catalogue.models.map(model => model.id))
    return Response.json({
      transcription: models.has('openai/gpt-4o-transcribe'),
      speech: models.has('openai/tts-1-hd'),
      note: 'Models listed in Gateway. Account access is confirmed on use.',
    }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch {
    return Response.json({ transcription: false, speech: false, note: 'Cloud model availability could not be checked. Browser speech may still work.' })
  }
}
