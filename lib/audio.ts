export const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']
export function supportedAudioType(type: string) { return AUDIO_TYPES.includes(type.split(';')[0].trim().toLowerCase()) }

export function createRecorder(stream: MediaStream) {
  for (const mimeType of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 })
    } catch { /* Some engines advertise a codec but reject its recorder options. */ }
  }
  return new MediaRecorder(stream)
}

export function microphoneError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Microphone access is blocked. Allow it in site settings over HTTPS, or open an embedded preview in its own tab. You can type instead.'
    if (error.name === 'NotFoundError') return 'No microphone was found. Connect a microphone or type instead.'
    if (error.name === 'NotReadableError') return 'The microphone is busy or unavailable. Close other recording apps and try again.'
  }
  return error instanceof Error ? error.message : 'Microphone access failed. You can type instead.'
}
