'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

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
const fetcher = async (url: string) => { const res = await fetch(url); if (!res.ok) throw new Error('Cannot check cloud availability'); return res.json() }
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
  const [canRecord, setCanRecord] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [seconds, setSeconds] = useState(0)
  const [activeEngine, setActiveEngine] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [cloudInputFailed, setCloudInputFailed] = useState(false)
  const [cloudOutputFailed, setCloudOutputFailed] = useState(false)
  const { data: capabilities, isLoading: checkingCloud } = useSWR<{ transcription: boolean; speech: boolean; note: string }>('/api/capabilities', fetcher, { revalidateOnFocus: false, shouldRetryOnError: false })
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
    setPlayingId(null)
    setStatus(current => current === 'speaking' || current === 'loading-audio' ? 'idle' : current)
  }
  function cancelRecording() {
    recording.current++
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
    setBrowserInput(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    setCanRecord(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
    const updateVoices = () => setVoices(window.speechSynthesis?.getVoices() ?? [])
    updateVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', updateVoices)
    const resource = resources.current
    return () => {
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
  const inputEngine = engine === 'auto' ? capabilities?.transcription && canRecord && !cloudInputFailed ? 'cloud' : browserInput ? 'browser' : 'cloud' : engine
  const outputEngine = engine === 'auto' ? capabilities?.speech && !cloudOutputFailed ? 'cloud' : matchingVoice(replyLanguage) ? 'browser' : 'cloud' : engine

  async function speak(message: ChatMessage) {
    stopAudio()
    if (!message.content || !message.complete) return
    const token = playback.current
    setNotice('')
    setPlayingId(message.id)
    setStatus('loading-audio')
    const browserSpeak = () => {
      const voice = matchingVoice(message.language)
      if (!voice || !('speechSynthesis' in window)) throw new Error(`No ${message.language === 'ta' ? 'Tamil' : 'English'} browser voice is installed. Try Cloud speech in Voice settings; your text reply is still available.`)
      const utterance = new SpeechSynthesisUtterance(message.content)
      resources.current.utterance = utterance
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = speed
      utterance.onend = () => { if (token === playback.current) { setStatus('idle'); setPlayingId(null) } }
      utterance.onerror = event => { if (token === playback.current && event.error !== 'canceled' && event.error !== 'interrupted') { setNotice('Playback could not start. Tap the reply’s play button to try again.'); setStatus('idle'); setPlayingId(null) } }
      setActiveEngine('Browser voice'); setStatus('speaking')
      window.speechSynthesis.speak(utterance)
    }
    const selected = engine === 'auto' ? capabilities?.speech && !cloudOutputFailed ? 'cloud' : matchingVoice(message.language) ? 'browser' : 'cloud' : engine
    try {
      if (selected === 'browser') { browserSpeak(); return }
      const abort = new AbortController(); resources.current.audioAbort = abort
      let response: Response
      try {
        response = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message.content, language: message.language, speed }), signal: abort.signal })
        if (!response.ok) throw new Error(await responseError(response))
      } catch (error) {
        if (token !== playback.current) return
        setCloudOutputFailed(true)
        if (engine === 'auto' && matchingVoice(message.language)) { setNotice('Cloud voice is unavailable. Playing with a browser voice instead.'); browserSpeak(); return }
        throw error
      }
      const blob = await response.blob()
      if (token !== playback.current) return
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      resources.current.audio = audio; resources.current.url = url
      audio.onended = () => { if (token === playback.current) { stopAudio(); setStatus('idle') } }
      audio.onerror = () => { if (token === playback.current) { stopAudio(); setNotice('Audio playback failed. Please try the play button again.') } }
      setActiveEngine('Cloud voice'); setStatus('speaking')
      try { await audio.play() } catch { throw new Error('Your browser blocked automatic audio. Tap the reply’s play button to listen.') }
    } catch (error) {
      if (token !== playback.current) return
      stopAudio(); setStatus('idle'); setNotice(error instanceof Error ? error.message : 'Voice playback is unavailable.')
    }
  }

  function finishRecording() {
    clearTimers()
    resources.current.recognition?.stop()
    if (resources.current.recorder?.state === 'recording') resources.current.recorder.stop()
    resources.current.stream?.getTracks().forEach(track => track.stop())
  }

  async function startRecording() {
    if (sending.current) return
    stopAudio(); setNotice(''); setSeconds(0)
    const token = ++recording.current
    const existing = draft.trim()
    const applyTranscript = (text: string) => setDraft([existing, text].filter(Boolean).join(' ').slice(0, 3000))
    const beginTimer = () => {
      const start = Date.now()
      resources.current.timer = setInterval(() => setSeconds(Math.min(30, Math.floor((Date.now() - start) / 1000))), 250)
      resources.current.limit = setTimeout(finishRecording, 30_000)
    }
    try {
      if (inputEngine === 'browser') {
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
          clearTimers(); setStatus('idle')
          setNotice(event.error === 'not-allowed' ? 'Microphone permission was denied. Allow microphone access in your browser, or type below. Embedded previews may require opening the app in a new tab.' : 'Browser recognition could not hear you. Try again, switch to Cloud speech, or type your message.')
        }
        recognition.onend = () => { if (token === recording.current) { clearTimers(); setStatus('idle'); resources.current.recognition = undefined } }
        recognition.start(); setStatus('listening'); setActiveEngine('Browser recognition'); beginTimer(); return
      }
      if (!canRecord) throw new Error('Microphone recording is unavailable here. Use a recent browser over HTTPS, or type your message.')
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (token !== recording.current) { stream.getTracks().forEach(track => track.stop()); return }
      resources.current.stream = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('This browser cannot record a supported format. Try Browser speech or type instead.')
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 })
      resources.current.recorder = recorder
      const chunks: Blob[] = []
      let size = 0
      recorder.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 3_000_000 && recorder.state === 'recording') recorder.stop() } }
      recorder.onerror = () => { if (token === recording.current) { cancelRecording(); setNotice('Recording failed. Please try again or type your message.') } }
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop()); clearTimers()
        if (token !== recording.current) return
        setStatus('transcribing')
        try {
          const blob = new Blob(chunks, { type: mimeType })
          if (blob.size > 3_000_000) throw new Error('The recording is too large. Please record a shorter message.')
          const abort = new AbortController(); resources.current.recordAbort = abort
          const response = await fetch('/api/transcribe', { method: 'POST', body: blob, headers: { 'Content-Type': mimeType, 'X-Input-Language': inputLanguage }, signal: abort.signal })
          if (!response.ok) { if (response.status >= 500) setCloudInputFailed(true); throw new Error(await responseError(response)) }
          const data = await response.json()
          if (token === recording.current) { applyTranscript(data.text); setStatus('idle'); setNotice('Transcript ready. Review it below, then send.') }
        } catch (error) { if (token === recording.current) { setStatus('idle'); setNotice(error instanceof Error ? error.message : 'Transcription failed. Please try again.') } }
      }
      recorder.start(1000); setStatus('listening'); setActiveEngine('Cloud transcription'); beginTimer()
    } catch (error) {
      if (token !== recording.current) return
      clearTimers(); resources.current.stream?.getTracks().forEach(track => track.stop()); setStatus('idle')
      setNotice(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Allow microphone access in your browser to start. If you are in an embedded preview, open the app in a new tab. You can always type instead.' : error instanceof Error ? error.message : 'Microphone access failed. You can type instead.')
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending.current || ['listening', 'requesting', 'transcribing'].includes(status)) return
    stopAudio(); setNotice(''); sending.current = true
    const token = ++session.current
    const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, language: replyLanguage, complete: true }
    const assistant: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', language: replyLanguage, complete: false }
    const history = [...messages.filter(message => message.complete && message.content), user].slice(-19)
    setMessages([...messages, user, assistant]); setDraft(''); setStatus('thinking')
    const abort = new AbortController(); resources.current.chatAbort = abort
    let answer = ''; let finished = false
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: replyLanguage, messages: history.map(({ role, content }) => ({ role, content })) }), signal: abort.signal })
      if (!response.ok) throw new Error(await responseError(response))
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reply was received.')
      const decoder = new TextDecoder(); let pending = ''
      while (true) {
        const { value, done } = await reader.read()
        if (token !== session.current) return
        pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
        const lines = pending.split('\n'); pending = lines.pop() ?? ''
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

  return { inputLanguage, setInputLanguage, replyLanguage, setReplyLanguage, engine, setEngine, autoPlay, setAutoPlay, speed, setSpeed, draft, setDraft, messages, status, notice, setNotice, browserInput, canRecord, voices, seconds, activeEngine, playingId, capabilities, checkingCloud, inputEngine, outputEngine, cloudInputFailed, cloudOutputFailed, send, speak, startRecording, finishRecording, cancelRecording, stopAudio, stopGeneration, reset }
}

export type VoiceSession = ReturnType<typeof useVoiceSession>
