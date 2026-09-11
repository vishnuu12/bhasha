export const ANDROID_ORIGIN = 'https://localhost'

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') return false
  if (origin === ANDROID_ORIGIN) return true
  try {
    const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const target = new URL(request.url)
    if (forwardedHost) target.host = forwardedHost
    const protocol = request.headers.get('x-forwarded-proto')
    if (protocol === 'https' || protocol === 'http') target.protocol = `${protocol}:`
    return origin === target.origin
  } catch { return false }
}
