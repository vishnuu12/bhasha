import test from 'node:test'
import assert from 'node:assert/strict'
import { createRecorder, microphoneError, supportedAudioType } from '../lib/audio'

test('Safari-style MP4 recorder is selected when WebM is unsupported', () => {
  class Recorder {
    static isTypeSupported(type: string) { return type === 'audio/mp4' }
    constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {}
  }
  const previous = globalThis.MediaRecorder
  try {
    globalThis.MediaRecorder = Recorder as unknown as typeof MediaRecorder
    assert.equal((createRecorder({} as MediaStream) as unknown as Recorder).options?.mimeType, 'audio/mp4')
  } finally { globalThis.MediaRecorder = previous }
})

test('recorder falls back to browser defaults if advertised options fail', () => {
  class Recorder {
    static isTypeSupported() { return true }
    constructor(public stream: MediaStream, public options?: MediaRecorderOptions) { if (options) throw new Error('unsupported options') }
  }
  const previous = globalThis.MediaRecorder
  try {
    globalThis.MediaRecorder = Recorder as unknown as typeof MediaRecorder
    assert.equal((createRecorder({} as MediaStream) as unknown as Recorder).options, undefined)
  } finally { globalThis.MediaRecorder = previous }
})

test('audio formats and microphone failures have actionable fallbacks', () => {
  assert.equal(supportedAudioType('audio/mp4;codecs=mp4a.40.2'), true)
  assert.equal(supportedAudioType('video/webm'), false)
  assert.match(microphoneError(new DOMException('denied', 'NotAllowedError')), /type instead/)
  assert.match(microphoneError(new DOMException('busy', 'NotReadableError')), /Close other recording apps/)
})
