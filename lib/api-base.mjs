export function validateApiBase(value) {
  if (!value) throw new Error('Supply --api-base-url https://your-deployment.vercel.app (or NEXT_PUBLIC_API_BASE_URL). Deploy the web backend first.')
  let url
  try { url = new URL(value) } catch { throw new Error('The API base must be an absolute HTTPS origin.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.hostname === 'localhost') {
    throw new Error('The API base must be a remote HTTPS origin without credentials, path, query, or fragment.')
  }
  return url.origin
}
