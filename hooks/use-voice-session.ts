'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { App } from '@capacitor/app'
import { apiFetch, isNative, isNativeAndroid, MicrophoneDeniedError, openMicrophoneSettings, requestNativeMicrophone } from '@/lib/platform'
import { selectInputEngine, selectOutputEngine } from '@/lib/speech-policy'
import { createRecorder, microphoneError, supportedAudioType } from '@/lib/audio'

export type InputLanguage = 'ta' | 'en' | 'mix'
export type ReplyLanguage = 'ta' | 'en'
export type SpeechEngine = 'auto' | 'cloud' | 'browser'
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; language: ReplyLanguage; complete: boolean }
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const fetcher = async (url: `/api/${string}`) => { const res = await apiFetch(url); if (!res.ok) throw new Error('Cannot check cloud availability'); return res.json() }
async function responseError(response: Response) { try { return (await response.json()).error || 'Please try again.' } catch { return 'The service is unavailable. Please try again.' } }

export function useVoiceSession() {
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>('mix')
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>('en')
  const [engine, setEngine] = useState<SpeechEngine>('auto')
  const [autoPlay, setAutoPlay] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<'idle' | 'requesting' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'loading-audio'>('idle')
  const [notice, setNotice] = useState('')
  const [browserInput, setBrowserInput] = useState(false)
  const [nativeAndroid, setNativeAndroid] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const nativePermissionPending = useRef(false)
  const [canRecord, setCanRecord] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [seconds, setSeconds] = useState(0)
  const [activeEngine, setActiveEngine] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [cloudInputFailed, setCloudInputFailed] = useState(false)
  const [cloudOutputFailed, setCloudOutputFailed] = useState(false)
  const [online, setOnline] = useState(true)
  const [browserInputFailed, setBrowserInputFailed] = useState(false)
  const [preparedId, setPreparedId] = useState<string | null>(null)
  const [fallbackInput, setFallbackInput] = useState<'cloud' | 'browser' | null>(null)
  const captureBusy = useRef(false)
  const { data: capabilities, isLoading: checkingCloud, error: capabilityError, mutate: refreshCapabilities } = useSWR<{ transcription: boolean; speech: boolean; note: string }>('/api/capabilities', fetcher, { revalidateOnFocus: false, shouldRetryOnError: false })
  const resources = useRef<{ recorder?: MediaRecorder; stream?: MediaStream; recognition?: Recognition; audio?: HTMLAudioElement; url?: string; utterance?: SpeechSynthesisUtterance; timer?: ReturnType<typeof setInterval>; limit?: ReturnType<typeof setTimeout>; recordAbort?: AbortController; chatAbort?: AbortController; audioAbort?: AbortController }>({})
  const session = useRef(0)
  const playback = useRef(0)
  const recording = useRef(0)
  const sending = useRef(false)

  function clearTimers() { clearInterval(resources.current.timer); clearTimeout(resources.current.limit) }
  function stopAudio() {
    playback.current++
    resources.current.audioAbort?.abort()
    resources.current.audio?.pause()
    if (resources.current.url) URL.revokeObjectURL(resources.current.url)
    resources.current.audio = undefined; resources.current.url = undefined
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setPlayingId(null); setPreparedId(null)
    resources.current.utterance = undefined
    setStatus(current => current === 'speaking' || current === 'loading-audio' ? 'idle' : current)
  }
  function cancelRecording() {
    recording.current++; captureBusy.current = false
    clearTimers()
    resources.current.recordAbort?.abort()
    resources.current.recognition?.abort()
    if (resources.current.recorder?.state === 'recording') resources.current.recorder.stop()
    resources.current.stream?.getTracks().forEach(track => track.stop())
    setStatus('idle')
  }
  function stopGeneration() { session.current++; resources.current.chatAbort?.abort(); sending.current = false; setStatus('idle') }
  function reset() { stopGeneration(); cancelRecording(); stopAudio(); setMessages([]); setDraft(''); setNotice(''); setActiveEngine('') }

  useEffect(() => {
    const w = window as SpeechWindow
    setNativeAndroid(isNativeAndroid())
    setBrowserInput(!isNativeAndroid() && !!(w.SpeechRecognition || w.webkitSpeechRecognition))
    setCanRecord(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline)
    const suspend = () => {
      // Android's system permission dialog can briefly pause the activity.
      if (nativePermissionPending.current) return
      stopGeneration(); cancelRecording(); stopAudio()
    }
    const onVisibility = () => { if (document.hidden) suspend() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', suspend)
    const nativeListeners = isNative() ? [
      App.addListener('appStateChange', ({ isActive }) => { if (!isActive) suspend() }),
      App.addListener('backButton', () => { suspend(); void App.minimizeApp() }),
    ] : []
    const updateVoices = () => setVoices(window.speechSynthesis?.getVoices() ?? [])
    updateVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', updateVoices)
    const resource = resources.current
    return () => {
      window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline)
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', suspend)
      nativeListeners.forEach(listener => { void listener.then(handle => handle.remove()).catch(() => {}) })
      session.current++; playback.current++; recording.current++
      clearInterval(resource.timer); clearTimeout(resource.limit)
      resource.chatAbort?.abort(); resource.audioAbort?.abort(); resource.recordAbort?.abort()
      resource.recognition?.abort()
      if (resource.recorder?.state === 'recording') resource.recorder.stop()
      resource.stream?.getTracks().forEach(track => track.stop())
      resource.audio?.pause()
      if (resource.url) URL.revokeObjectURL(resource.url)
      window.speechSynthesis?.cancel()
      window.speechSynthesis?.removeEventListener('voiceschanged', updateVoices)
    }
  }, [])

  const matchingVoice = (language: ReplyLanguage) => voices.find(voice => voice.lang.toLowerCase().startsWith(language))
  const inputEngine = selectInputEngine({ engine, nativeAndroid, canRecord, cloudAvailable: !!capabilities?.transcription, cloudFailed: cloudInputFailed, browserAvailable: browserInput, browserFailed: browserInputFailed })
  function retryCloud() { setCloudInputFailed(false); setCloudOutputFailed(false); setBrowserInputFailed(false); setFallbackInput(null); void refreshCapabilities() }
  const outputFor = (language: ReplyLanguage) => selectOutputEngine({ engine, nativeAndroid, cloudAvailable: !!capabilities?.speech, cloudFailed: cloudOutputFailed, matchingVoice: !!matchingVoice(language) })
  const outputEngine = outputFor(replyLanguage)
  async function openPermissionSettings() {
    try { await openMicrophoneSettings() }
    catch (error) { setNotice(microphoneError(error)) }
  }

  function playPrepared() {
    const audio = resources.current.audio
    if (!audio || !preparedId) return
    const token = playback.current
    // Invoke play synchronously in the tap handler so Safari retains user activation.
    const result = audio.play()
    void result.then(() => {
      if (token !== playback.current) return
      setPlayingId(preparedId); setPreparedId(null); setStatus('speaking'); setNotice('')
    }).catch(() => { if (token === playback.current) setNotice('Playback is still blocked. Check sound permissions or read the reply.') })
  }

  async function speak(message: ChatMessage) {
    if (captureBusy.current || sending.current) return
    if (preparedId === message.id && resources.current.audio) { playPrepared(); return }
    stopAudio()
    if (!message.content || !message.complete) return
    const token = playback.current
    setNotice(''); setPlayingId(message.id); setStatus('loading-audio')
    const attempted = new Set<string>()
    const failed = (error: unknown) => {
      if (token !== playback.current) return
      stopAudio(); setNotice(error instanceof Error ? error.message : 'Voice playback is unavailable. Your text reply is still here.')
    }
    const run = async (selected: 'cloud' | 'browser'): Promise<void> => {
      if (token !== playback.current || attempted.has(selected)) return
      attempted.add(selected)
      const fallback = async (error: unknown) => {
        if (token !== playback.current) return
        if (selected === 'cloud') setCloudOutputFailed(true)
        const next = selected === 'cloud' ? 'browser' : 'cloud'
        if (engine === 'auto' && !attempted.has(next) && (next === 'cloud' ? navigator.onLine : !nativeAndroid && !!matchingVoice(message.language))) {
          resources.current.audio?.pause()
          if (resources.current.url) URL.revokeObjectURL(resources.current.url)
          resources.current.audio = undefined; resources.current.url = undefined
          setNotice(`${selected === 'cloud' ? 'Cloud' : 'Browser'} voice failed. Trying ${next} voice.`)
          await run(next)
        } else failed(error)
      }
      try {
        if (selected === 'browser') {
          const voice = matchingVoice(message.language)
          if (!voice || typeof SpeechSynthesisUtterance === 'undefined' || !window.speechSynthesis) throw new Error('No matching browser voice is installed. Choose Cloud speech or read the reply.')
          const utterance = new SpeechSynthesisUtterance(message.content)
          resources.current.utterance = utterance
          utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = speed
          utterance.onend = () => { if (token === playback.current) stopAudio() }
          utterance.onerror = event => { if (event.error !== 'canceled' && event.error !== 'interrupted') void fallback(new Error('Browser voice failed. Tap play to retry or choose another engine.')) }
          setActiveEngine('Browser voice'); setStatus('speaking')
          window.speechSynthesis.speak(utterance)
          return
        }
        const abort = new AbortController(); resources.current.audioAbort = abort
        const response = await apiFetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message.content, language: message.language, speed }), signal: abort.signal })
        if (!response.ok) throw new Error(await responseError(response))
        const blob = await response.blob()
        if (token !== playback.current) return
        if (!blob.size) throw new Error('No audio was returned.')
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        resources.current.audio = audio; resources.current.url = url
        audio.onended = () => { if (token === playback.current) stopAudio() }
        audio.onerror = () => { void fallback(new Error('The audio format could not be played.')) }
        setActiveEngine('Cloud voice')
        try {
          await audio.play()
          if (token === playback.current) setStatus('speaking')
        } catch (error) {
          if (token !== playback.current) return
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            setPreparedId(message.id); setPlayingId(null); setStatus('idle')
            setNotice('Audio is ready. Tap Play prepared audio to allow sound; no new request is needed.')
          } else throw error
        }
      } catch (error) { await fallback(error) }
    }
    await run(outputFor(message.language))
  }

  function finishRecording() {
    clearTimers()
    resources.current.recognition?.stop()
    if (resources.current.recorder?.state === 'recording') resources.current.recorder.stop()
    resources.current.stream?.getTracks().forEach(track => track.stop())
  }

  async function startRecording(override?: 'cloud' | 'browser') {
    if (sending.current || captureBusy.current || nativePermissionPending.current) return
    captureBusy.current = true
    const selectedInput = isNativeAndroid() ? 'cloud' : override ?? inputEngine
    stopAudio(); setNotice(''); setSeconds(0); setFallbackInput(null); setStatus('requesting')
    const token = ++recording.current
    const existing = draft.trim()
    const applyTranscript = (text: string) => setDraft([existing, text].filter(Boolean).join(' ').slice(0, 3000))
    const beginTimer = () => {
      const start = Date.now()
      resources.current.timer = setInterval(() => setSeconds(Math.min(30, Math.floor((Date.now() - start) / 1000))), 250)
      resources.current.limit = setTimeout(finishRecording, 30_000)
    }
    try {
      if (selectedInput === 'cloud' && !navigator.onLine) throw new Error('Cloud recording needs a connection. Your draft remains available for editing.')
      nativePermissionPending.current = isNativeAndroid()
      try { await requestNativeMicrophone() }
      finally { nativePermissionPending.current = false }
      if (token !== recording.current) return
      if (document.hidden) { cancelRecording(); return }
      setPermissionDenied(false)
      if (selectedInput === 'browser') {
        const w = window as SpeechWindow
        const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition
        if (!Constructor) throw new Error('This browser does not support speech recognition. Choose Cloud speech or type instead.')
        const recognition = new Constructor()
        resources.current.recognition = recognition
        recognition.lang = inputLanguage === 'en' ? 'en-IN' : 'ta-IN'
        recognition.continuous = true; recognition.interimResults = true
        recognition.onresult = event => {
          if (token !== recording.current) return
          applyTranscript(Array.from(event.results).map(result => result[0].transcript).join(' '))
        }
        recognition.onerror = event => {
          if (token !== recording.current) return
          recording.current++; captureBusy.current = false
          recognition.abort(); resources.current.recognition = undefined
          clearTimers(); setStatus('idle'); setBrowserInputFailed(true)
          if (['not-allowed', 'service-not-allowed'].includes(event.error)) setPermissionDenied(true)
          if (engine === 'auto' && canRecord && !['not-allowed', 'service-not-allowed'].includes(event.error)) setFallbackInput('cloud')
          setNotice(event.error === 'not-allowed' ? 'Microphone permission was denied. Allow microphone access in your browser, or type below. Embedded previews may require opening the app in a new tab.' : 'Browser recognition could not hear you. Try again, switch to Cloud speech, or type your message.')
        }
        recognition.onend = () => { if (token === recording.current) { captureBusy.current = false; clearTimers(); setStatus('idle'); resources.current.recognition = undefined } }
        recognition.start(); setStatus('listening'); setActiveEngine('Browser recognition'); beginTimer(); return
      }
      if (!canRecord) throw new Error('Microphone recording is unavailable here. Use a recent browser over HTTPS, or type your message.')
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (token !== recording.current) { stream.getTracks().forEach(track => track.stop()); return }
      resources.current.stream = stream
      const recorder = createRecorder(stream)
      resources.current.recorder = recorder
      const chunks: Blob[] = []
      let size = 0
      recorder.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 3_000_000 && recorder.state === 'recording') recorder.stop() } }
      recorder.onerror = () => { if (token === recording.current) { cancelRecording(); setNotice('Recording failed. Please try again or type your message.') } }
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        if (token !== recording.current) return
        clearTimers()
        setStatus('transcribing')
        try {
          const mimeType = recorder.mimeType || chunks.find(chunk => chunk.type)?.type || ''
          if (!supportedAudioType(mimeType)) throw new Error('This browser recorded an unsupported format. Try Browser speech or type instead.')
          const blob = new Blob(chunks, { type: mimeType })
          if (blob.size < 100) throw new Error('No audio was captured. Check your microphone and record again.')
          if (blob.size > 3_000_000) throw new Error('The recording is too large. Please record a shorter message.')
          const abort = new AbortController(); resources.current.recordAbort = abort
          const response = await apiFetch('/api/transcribe', { method: 'POST', body: blob, headers: { 'Content-Type': mimeType, 'X-Input-Language': inputLanguage }, signal: abort.signal })
          if (!response.ok) { if (response.status >= 500) setCloudInputFailed(true); throw new Error(await responseError(response)) }
          const data = await response.json()
          if (token === recording.current) { applyTranscript(data.text); setStatus('idle'); setNotice('Transcript ready. Review it below, then send.') }
        } catch (error) { if (token === recording.current) { setStatus('idle'); setCloudInputFailed(true); if (engine === 'auto' && browserInput) setFallbackInput('browser'); setNotice(error instanceof Error ? error.message : 'Transcription failed. Please try again.') } }
        finally { if (token === recording.current) captureBusy.current = false }
      }
      recorder.start(1000); setStatus('listening'); setActiveEngine('Cloud transcription'); beginTimer()
    } catch (error) {
      if (token !== recording.current) return
      captureBusy.current = false
      clearTimers(); resources.current.stream?.getTracks().forEach(track => track.stop()); setStatus('idle')
      if (error instanceof MicrophoneDeniedError || (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name))) setPermissionDenied(true)
      setNotice(microphoneError(error))
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending.current || captureBusy.current) return
    if (!navigator.onLine) { setNotice('You are offline. Reconnect to send; your draft is still here.'); return }
    stopAudio(); setNotice(''); sending.current = true
    const token = ++session.current
    const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, language: replyLanguage, complete: true }
    const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', language: replyLanguage, complete: false }
    const history = [...messages.filter(message => message.complete && message.content), user].slice(-19)
    setMessages([...messages, user, assistant]); setDraft(''); setStatus('thinking')
    const abort = new AbortController(); resources.current.chatAbort = abort
    let answer = ''; let finished = false
    try {
      const response = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: replyLanguage, messages: history.map(({ role, content }) => ({ role, content })) }), signal: abort.signal })
      if (!response.ok) throw new Error(await responseError(response))
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reply was received.')
      const decoder = new TextDecoder(); let pending = ''
      while (true) {
        const { value, done } = await reader.read()
        if (token !== session.current) return
        pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
        const lines = pending.split('\n'); pending = done ? '' : lines.pop() ?? ''
        for (const line of lines) {
          if (!line) continue
          const event = JSON.parse(line)
          if (event.error) throw new Error(event.error)
          if (event.text) { answer += event.text; setMessages(current => current.map(message => message.id === assistant.id ? { ...message, content: answer } : message)) }
          if (event.done) finished = true
        }
        if (done) break
      }
      if (!finished || !answer.trim()) throw new Error('No complete reply was received. Please try again.')
      const completed = { ...assistant, content: answer, complete: true }
      setMessages(current => current.map(message => message.id === assistant.id ? completed : message))
      sending.current = false; setStatus('idle')
      if (autoPlay) void speak(completed)
    } catch (error) {
      if (token !== session.current) return
      setNotice(error instanceof Error ? error.message : 'The AI could not reply. Please try again.')
      setDraft(text)
      setMessages(current => current.filter(message => message.id !== assistant.id || !!message.content))
      setStatus('idle')
    } finally { if (token === session.current) sending.current = false }
  }

  return { nativeAndroid, permissionDenied, openPermissionSettings, online, capabilityError, retryCloud, preparedId, playPrepared, fallbackInput, inputLanguage, setInputLanguage, replyLanguage, setReplyLanguage, engine, setEngine, autoPlay, setAutoPlay, speed, setSpeed, draft, setDraft, messages, status, notice, setNotice, browserInput, canRecord, voices, seconds, activeEngine, playingId, capabilities, checkingCloud, inputEngine, outputEngine, cloudInputFailed, cloudOutputFailed, send, speak, startRecording, finishRecording, cancelRecording, stopAudio, stopGeneration, reset }
}

export type VoiceSession = ReturnType<typeof useVoiceSession>
