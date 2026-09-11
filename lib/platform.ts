import { Capacitor, registerPlugin } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()
export const isNativeAndroid = () => isNative() && Capacitor.getPlatform() === 'android'
const Microphone = registerPlugin<{ requestAccess(): Promise<{ granted: boolean }>; openSettings(): Promise<void> }>('Microphone')

export class MicrophoneDeniedError extends Error {}
export async function openMicrophoneSettings() {
  if (isNativeAndroid()) await Microphone.openSettings()
}

export async function requestNativeMicrophone() {
  if (!isNativeAndroid()) return
  const result = await Microphone.requestAccess()
  if (!result.granted) throw new MicrophoneDeniedError('Microphone permission is denied. Open Android Settings → Apps → Mozhi → Permissions → Microphone to allow access, or type instead.')
}

export function apiUrl(path: `/api/${string}`) {
  if (process.env.NEXT_PUBLIC_APP_TARGET !== 'mobile') return path
  const base = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!base) throw new Error('This Android build has no backend URL. Rebuild with NEXT_PUBLIC_API_BASE_URL.')
  return `${base}${path}`
}

export async function apiFetch(path: `/api/${string}`, init?: RequestInit) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You are offline. Your draft is still here; reconnect to use cloud services.')
  const url = apiUrl(path)
  try {
    return await fetch(url, { ...init, credentials: 'omit', cache: 'no-store' })
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new Error('Cannot reach the backend. Check your connection and try again. Android builds also require the server’s allowed app origin.')
  }
}
