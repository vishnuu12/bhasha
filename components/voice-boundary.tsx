'use client'

import { Component, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export class VoiceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="mx-auto max-w-xl p-6"><Alert><AlertTitle>Mozhi needs a fresh start.</AlertTitle><AlertDescription>The interface encountered an error. Restarting clears the in-memory conversation and draft.<Button onClick={() => this.setState({ failed: false })}>Restart conversation</Button></AlertDescription></Alert></main>
  }
}
