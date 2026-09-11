'use client'

import { Cloud, Laptop, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import type { SpeechEngine, VoiceSession } from '@/hooks/use-voice-session'

export function VoiceSettings({ voice }: { voice: VoiceSession }) {
  const locked = !['idle', 'speaking'].includes(voice.status)
  const tamilVoice = voice.voices.some(item => item.lang.toLowerCase().startsWith('ta'))
  const englishVoice = voice.voices.some(item => item.lang.toLowerCase().startsWith('en'))
  return <Dialog><DialogTrigger render={<Button variant="ghost" />}><SlidersHorizontal data-icon="inline-start" />Voice settings</DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Make yourself comfortable.</DialogTitle><DialogDescription>Choose how Mozhi listens and speaks.</DialogDescription></DialogHeader>
      <FieldGroup>
        <Field><FieldLabel id="engine-label">Speech engine</FieldLabel>
          <ToggleGroup aria-labelledby="engine-label" value={[voice.engine]} onValueChange={values => { if (values[0]) { voice.stopAudio(); voice.setEngine(values[0] as SpeechEngine) } }} variant="outline" className="flex-wrap" disabled={locked}>
            <ToggleGroupItem value="auto"><Sparkles /> Auto</ToggleGroupItem><ToggleGroupItem value="cloud"><Cloud /> Cloud</ToggleGroupItem><ToggleGroupItem value="browser" disabled={voice.nativeAndroid}><Laptop /> Browser</ToggleGroupItem>
          </ToggleGroup>
          {voice.nativeAndroid && <FieldDescription>Android uses cloud transcription and voice playback. WebView browser speech is unreliable, so browser mode is unavailable here. If cloud speech fails, retry or use text.</FieldDescription>}
          <FieldDescription>Auto selects input and output independently. Cloud access is confirmed on use; if transcription fails, switch engines and re-record. You can always edit your draft; sending requires connectivity.</FieldDescription>
        </Field>
        <Field><FieldLabel id="speed-label">Speaking speed</FieldLabel><ToggleGroup aria-labelledby="speed-label" value={[String(voice.speed)]} onValueChange={values => { if (values[0]) { voice.stopAudio(); voice.setSpeed(Number(values[0])) } }} variant="outline" className="flex-wrap" disabled={locked}><ToggleGroupItem value="0.85">Relaxed</ToggleGroupItem><ToggleGroupItem value="1">Natural</ToggleGroupItem><ToggleGroupItem value="1.15">A little faster</ToggleGroupItem></ToggleGroup></Field>
        <Separator />
        <div className="flex flex-col gap-3 text-sm"><h3 className="font-medium">On this browser</h3>
          <dl className="flex flex-col gap-2">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Browser recognition</dt><dd>{voice.browserInput ? 'Supported' : 'Not supported'}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">English voice</dt><dd>{englishVoice ? 'Installed' : 'Not installed'}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Tamil voice</dt><dd>{tamilVoice ? 'Installed' : 'Not installed'}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Cloud transcription</dt><dd>{voice.cloudInputFailed ? 'Last request failed' : voice.capabilities?.transcription ? 'Listed · access on use' : voice.checkingCloud ? 'Checking…' : 'Unconfirmed'}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Cloud voice</dt><dd>{voice.cloudOutputFailed ? 'Last request failed' : voice.capabilities?.speech ? 'Listed · access on use' : voice.checkingCloud ? 'Checking…' : 'Unconfirmed'}</dd></div>
          </dl>
          <Button variant="outline" disabled={locked || !voice.online} onClick={voice.retryCloud}>Retry cloud availability</Button>
          <p className="leading-relaxed text-muted-foreground">Tanglish is mixed Tamil and English, not a separate recognition locale. Browser mode uses a Tamil hint for mixed speech; results vary. Review your transcript before sending.</p>
        </div>
      </FieldGroup>
    </DialogContent>
  </Dialog>
}

export function PrivacyDialog() {
  return <Dialog><DialogTrigger render={<Button variant="link" className="h-auto p-0" />}>How your data is handled</DialogTrigger><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>A conversation, not a collection.</DialogTitle><DialogDescription>Here is what happens when you use Mozhi.</DialogDescription></DialogHeader><div className="flex flex-col gap-4 text-sm leading-relaxed"><p>Conversations live only in this open tab. The app does not save transcripts or raw recordings to a database. Refreshing or starting a new conversation clears the chat.</p><p>Messages and conversation context are sent to an AI provider for replies. Cloud speech sends recordings for transcription and reply text for AI-generated audio. Browser speech may also send data to your browser vendor; it is not guaranteed to run offline.</p><p>Provider retention policies are separate from this app. Avoid sharing sensitive information. Microphone access is requested only when you tap the mic, and recordings are limited to 30 seconds.</p><p>If microphone permission is blocked in an embedded preview, open the app in its own tab and check browser permissions. You can always use typed chat.</p></div></DialogContent></Dialog>
}
