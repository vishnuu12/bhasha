'use client'

import { useEffect, useState } from 'react'
import { isNative } from '@/lib/platform'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function PwaRegistration() {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_APP_TARGET === 'mobile' || isNative() || !('serviceWorker' in navigator)) return
    let active = true
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  if (!failed) return null
  return <div className="mx-auto max-w-7xl px-5 py-3"><Alert><AlertTitle>Offline app access is unavailable.</AlertTitle><AlertDescription>You can still use Mozhi while online. Reload to retry installing the app shell.</AlertDescription></Alert></div>
}
