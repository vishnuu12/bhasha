'use client'

import { useState } from 'react'
import { ArrowUp, AudioLines, Check, Copy, LoaderCircle, MessageCircle, Play, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from '@/components/ui/message-scroller'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { VoiceSession } from '@/hooks/use-voice-session'

export function ConversationPanel({ voice }: { voice: VoiceSession }) {
  const [copied, setCopied] = useState<string | null>(null)
  const busy = ['thinking', 'requesting', 'listening', 'transcribing'].includes(voice.status)
  async function copy(id: string, text: string) {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); setCopied(id) }
    catch { voice.setNotice('Clipboard access is unavailable. You can select and copy the reply text instead.') }
  }
  return (
    <section className="flex h-[510px] min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground lg:h-auto" aria-labelledby="conversation-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <h2 id="conversation-heading" className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="size-4 text-primary" /> Conversation</h2>
        <div className="flex items-center gap-2"><Volume2 className="size-4 text-muted-foreground" /><label htmlFor="auto-play" className="text-sm text-muted-foreground">Auto-play</label><Switch id="auto-play" checked={voice.autoPlay} onCheckedChange={checked => { voice.setAutoPlay(checked); if (!checked) voice.stopAudio() }} /></div>
      </div>
      <Separator />
      <div className="flex min-h-0 flex-1">
        {voice.messages.length === 0 ? <Empty className="gap-5 px-6">
          <div aria-hidden="true" className="flex flex-col items-center gap-2">
            <div className="flex -translate-x-5 items-center gap-2 rounded-xl rounded-bl-sm border bg-background px-4 py-2.5 text-sm text-muted-foreground"><span lang="ta">வணக்கம்</span><AudioLines className="size-4" /></div>
            <div className="flex translate-x-5 items-center gap-2 rounded-xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground"><AudioLines className="size-4" /> Hello there.</div>
          </div>
          <EmptyHeader><EmptyTitle>Your words belong here.</EmptyTitle><EmptyDescription>Ask a question, explore an idea, or just say hello. We&apos;ll take it from there.</EmptyDescription></EmptyHeader>
        </Empty> : <MessageScrollerProvider><MessageScroller><MessageScrollerViewport><MessageScrollerContent className="gap-6 p-5">
          {voice.messages.map(message => <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === 'user'}>
            <Message align={message.role === 'user' ? 'end' : 'start'}><MessageContent>
              <MessageHeader className="text-sm">{message.role === 'user' ? 'You' : 'Mozhi'}</MessageHeader>
              <Bubble variant={message.role === 'user' ? 'secondary' : 'ghost'}><BubbleContent className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed" lang={message.role === 'assistant' ? message.language : undefined}>
                {message.content || (voice.status === 'thinking' ? <span className="flex items-center gap-2"><LoaderCircle className="size-4 motion-safe:animate-spin" /> Thinking…</span> : 'Reply stopped.')}
              </BubbleContent></Bubble>
              {message.role === 'assistant' && message.content && <MessageFooter className="gap-1 text-sm">
                {message.complete ? <><Button variant="ghost" size="icon-sm" disabled={busy} onClick={() => voice.playingId === message.id ? voice.stopAudio() : void voice.speak(message)} aria-label={voice.playingId === message.id ? 'Stop reply audio' : 'Play reply'}>{voice.playingId === message.id ? <Square /> : <Play />}</Button><Button variant="ghost" size="icon-sm" aria-label="Copy reply" onClick={() => void copy(message.id, message.content)}>{copied === message.id ? <Check /> : <Copy />}</Button><span className="text-sm text-muted-foreground">{voice.playingId === message.id ? voice.status === 'loading-audio' ? 'Preparing audio…' : 'Speaking…' : message.language === 'ta' ? 'Tamil' : 'English'}</span></> : voice.status !== 'thinking' && <span>Incomplete reply</span>}
              </MessageFooter>}
            </MessageContent></Message>
          </MessageScrollerItem>)}
        </MessageScrollerContent></MessageScrollerViewport><MessageScrollerButton /></MessageScroller></MessageScrollerProvider>}
      </div>
      <form className="flex flex-col gap-2 p-4" onSubmit={event => { event.preventDefault(); void voice.send() }}>
        <label htmlFor="message" className="sr-only">Message or editable transcript</label>
        <InputGroup>
          <InputGroupTextarea id="message" placeholder="Or type what’s on your mind…" value={voice.draft} maxLength={3000} disabled={busy} onChange={event => voice.setDraft(event.target.value)} className="min-h-12 max-h-36" onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void voice.send() }
          }} />
          <InputGroupAddon align="block-end" className="justify-between">
            <span className="text-sm text-muted-foreground">{voice.draft ? `${voice.draft.length} / 3,000` : 'Your language. Your way.'}</span>
            {voice.status === 'thinking' ? <InputGroupButton size="icon-sm" onClick={voice.stopGeneration} aria-label="Stop generating"><Square /></InputGroupButton> : <InputGroupButton size="icon-sm" variant="default" type="submit" disabled={!voice.draft.trim() || busy} aria-label="Send message"><ArrowUp /></InputGroupButton>}
          </InputGroupAddon>
        </InputGroup>
        <p className="text-center text-sm text-muted-foreground">AI can make mistakes. Keep a human perspective.</p>
      </form>
    </section>
  )
}
