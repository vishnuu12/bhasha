'use client'

import { AudioLines, Info, Plus, ShieldCheck, X } from 'lucide-react'
import { useVoiceSession } from '@/hooks/use-voice-session'
import { Button } from '@/components/ui/button'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { VoicePanel, ConversationStarters } from '@/components/voice-panel'
import { ConversationPanel } from '@/components/conversation-panel'
import { PrivacyDialog, VoiceSettings } from '@/components/voice-settings'

export function VoiceChat() {
  const voice = useVoiceSession()
  return <div className="flex min-h-dvh flex-col">
    <header className="border-b bg-card text-card-foreground">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-3" aria-label="Mozhi home"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><AudioLines className="size-5" /></span><span className="text-2xl font-semibold tracking-tight">mozhi<span className="text-primary">.</span></span><span lang="ta" className="hidden border-l pl-3 text-sm text-muted-foreground sm:block">மொழி</span></a>
        <div className="flex items-center gap-2 sm:gap-4"><span className="hidden text-sm text-muted-foreground md:block">A little closer to your language.</span><VoiceSettings voice={voice} /></div>
      </div>
    </header>
    <main className="app-enter mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-7 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2"><p className="text-sm font-medium text-primary">LESS TYPING. MORE YOU.</p><h1 className="text-balance text-3xl font-medium tracking-tight sm:text-4xl">Good conversations start naturally.</h1><p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">Speak your mind. We&apos;ll find the words together.</p></div>
        <Dialog><DialogTrigger render={<Button variant="outline" />}><Plus data-icon="inline-start" />New conversation</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Start fresh?</DialogTitle><DialogDescription>This clears the current conversation and any draft. Nothing is saved, so this cannot be undone.</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Keep chatting</DialogClose><DialogClose render={<Button onClick={voice.reset} />}>Start new conversation</DialogClose></DialogFooter></DialogContent></Dialog>
      </div>
      {voice.notice && <Alert><Info /><AlertDescription>{voice.notice}</AlertDescription><AlertAction><Button variant="ghost" size="icon-sm" onClick={() => voice.setNotice('')} aria-label="Dismiss notification"><X /></Button></AlertAction></Alert>}
      {(!voice.online || voice.capabilityError) && <Alert><Info /><AlertDescription>{!voice.online ? 'You are offline. You can edit your draft, but cloud services need a connection. Drafts are not saved after closing the app.' : 'Backend availability could not be checked. Check your connection or retry.'}<Button variant="outline" disabled={!voice.online} onClick={voice.retryCloud}>Retry connection</Button></AlertDescription></Alert>}
      {(voice.preparedId || voice.fallbackInput) && <div className="flex flex-wrap gap-3">
        {voice.preparedId && <Button onClick={voice.playPrepared}>Play prepared audio</Button>}
        {voice.fallbackInput && <Button variant="outline" disabled={voice.status !== 'idle'} onClick={() => void voice.startRecording(voice.fallbackInput ?? undefined)}>Record again with {voice.fallbackInput} speech</Button>}
      </div>}
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2"><VoicePanel voice={voice} /><ConversationPanel voice={voice} /></div>
      <div className="flex flex-wrap items-start justify-between gap-5"><ConversationStarters onSelect={text => { if (voice.status === 'idle' || voice.status === 'speaking') { voice.setDraft(text); document.getElementById('message')?.focus() } }} /><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" /><span>{voice.activeEngine || `Input: ${voice.inputEngine} · Voice: ${voice.outputEngine}`}</span></div></div>
    </main>
    <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-muted-foreground sm:px-8 lg:px-12"><p className="flex items-center gap-2"><ShieldCheck className="size-4" />No sign-up. No saved conversations.</p><div className="flex flex-wrap items-center gap-3"><span>AI-generated replies &amp; voice</span><PrivacyDialog /></div></footer>
  </div>
}
