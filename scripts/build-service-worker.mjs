import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
async function files(directory, prefix) {
  const entries = await readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name), `${prefix}/${entry.name}`)
    : entry.name.endsWith('.map') ? [] : [`${prefix}/${entry.name}`]))
  return groups.flat()
}
const build = (await readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim()
const template = await readFile(path.join(root, 'scripts/service-worker.js'), 'utf8')
const shell = ['/', '/manifest.json', ...await files(path.join(root, 'public/icons'), '/icons'), ...await files(path.join(root, '.next/static'), '/_next/static')].sort()
const hash = createHash('sha256').update(build).update(template).digest('hex').slice(0, 16)
await writeFile(path.join(root, 'public/sw.js'), template.replace('__CACHE_NAME__', JSON.stringify(`mozhi-shell-${hash}`)).replace('__SHELL_FILES__', JSON.stringify(shell)))
console.log(`Generated service worker: ${shell.length} shell assets; no API caching.`)
