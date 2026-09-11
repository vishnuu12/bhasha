'use client'

import type { CSSProperties } from 'react'
import { ArrowUpRight, AudioLines, Languages, LoaderCircle, Mic, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import type { InputLanguage, ReplyLanguage, VoiceSession } from '@/hooks/use-voice-session'

const barHeights = [7, 12, 19, 10, 25, 35, 21, 43, 29, 48, 34, 22, 41, 29, 49, 35, 23, 44, 27, 39, 18, 28, 15, 21, 12, 7]
const titles = { idle: 'Let’s talk.', requesting: 'One little permission…', listening: 'I’m listening.', transcribing: 'Finding your words…', thinking: 'A moment to think…', speaking: 'Here’s what I think.', 'loading-audio': 'Getting my voice ready…' }

export function VoicePanel({ voice }: { voice: VoiceSession }) {
  const { status } = voice
  const listening = status === 'listening'
  const playing = status === 'speaking' || status === 'loading-audio'
  const pending = ['requesting', 'transcribing', 'thinking', 'loading-audio'].includes(status)
  const locked = ['requesting', 'listening', 'transcribing', 'thinking'].includes(status)
  function onMicrophone() {
    if (listening) voice.finishRecording()
    else if (playing) voice.stopAudio()
    else if (status === 'requesting' || status === 'transcribing') voice.cancelRecording()
    else if (status === 'thinking') voice.stopGeneration()
    else void voice.startRecording()
  }
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground" aria-label="Voice controls">
      <div className="voice-stage flex flex-1 flex-col items-center justify-center gap-5 px-6 py-6">
        <Badge variant="secondary" className="h-7 text-sm"><AudioLines data-icon="inline-start" /> Made for the way you speak</Badge>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-balance text-2xl font-medium tracking-tight">{titles[status]}</h2>
          <p className="text-sm text-muted-foreground" role="status">{listening ? `Recording · 0:${String(voice.seconds).padStart(2, '0')} / 0:30` : status === 'idle' ? 'Tamil, English, or a little of both.' : voice.activeEngine || 'You can stop at any time.'}</p>
        </div>
        <div className="flex h-40 w-full items-center justify-center">
          <Button className="voice-control size-24 rounded-full [&_svg]:size-8" onClick={onMicrophone} aria-label={listening ? 'Stop recording' : playing ? 'Stop audio' : pending ? 'Cancel current operation' : 'Start recording'}>
            {pending ? <LoaderCircle className="motion-safe:animate-spin" /> : listening || playing ? <Square /> : <Mic />}
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div aria-hidden="true" className={cn('flex h-8 items-center gap-1', (listening || status === 'speaking') && 'voice-active')}>
            {barHeights.map((height, index) => <span key={index} className="voice-bar w-1 rounded-full bg-primary/35" style={{ '--bar-height': `${height * .55}px`, '--bar-delay': `${index * -.13}s` } as CSSProperties} />)}
          </div>
          <p className="text-sm text-muted-foreground">{listening ? 'Tap to finish. Review before you send.' : playing ? 'Tap to stop playback' : pending ? 'Tap to cancel' : 'Tap the mic to start a conversation'}</p>
        </div>
      </div>
      <Separator />
      <FieldGroup className="gap-4 p-5">
        <Field orientation="horizontal" className="flex-wrap justify-between gap-2">
          <FieldLabel id="input-language-label"><Languages className="size-4 text-muted-foreground" /> I&apos;m speaking</FieldLabel>
          <ToggleGroup aria-labelledby="input-language-label" value={[voice.inputLanguage]} onValueChange={value => { if (value[0]) voice.setInputLanguage(value[0] as InputLanguage) }} disabled={locked} variant="outline" spacing={0}>
            <ToggleGroupItem value="ta" aria-label="Speak Tamil"><span lang="ta">தமிழ்</span></ToggleGroupItem>
            <ToggleGroupItem value="en" aria-label="Speak English">English</ToggleGroupItem>
            <ToggleGroupItem value="mix" aria-label="Speak Tanglish">Tanglish</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal" className="flex-wrap justify-between gap-2">
          <FieldLabel id="reply-language-label"><Volume2 className="size-4 text-muted-foreground" /> Reply to me in</FieldLabel>
          <ToggleGroup aria-labelledby="reply-language-label" value={[voice.replyLanguage]} onValueChange={value => { if (value[0]) { voice.stopAudio(); voice.setReplyLanguage(value[0] as ReplyLanguage) } }} disabled={locked} variant="outline" spacing={0}>
            <ToggleGroupItem value="ta" aria-label="Reply in Tamil"><span lang="ta">தமிழ்</span></ToggleGroupItem>
            <ToggleGroupItem value="en" aria-label="Reply in English">English</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </FieldGroup>
    </section>
  )
}

export function ConversationStarters({ onSelect }: { onSelect: (text: string) => void }) {
  return <section className="flex flex-col gap-3" aria-label="Conversation starters">
    <p className="text-sm text-muted-foreground">A little inspiration to get you talking</p>
    <div className="flex flex-wrap gap-2">
      {[
        { label: 'Teach me something', text: 'Teach me something interesting about the Tamil language.' },
        { label: 'தமிழில் பேசலாம்', text: 'வணக்கம்! இன்று ஒரு சுவாரசியமான விஷயம் சொல்லுங்கள்.' },
        { label: 'Konjam help pannunga', text: 'Konjam help pannunga — how can I build a good morning routine?' },
      ].map(item => <Button key={item.label} variant="outline" onClick={() => onSelect(item.text)}>{item.label}<ArrowUpRight data-icon="inline-end" /></Button>)}
    </div>
  </section>
}
