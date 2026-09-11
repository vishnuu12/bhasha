import { cp, mkdir, rm, symlink, writeFile, readFile, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateApiBase } from '../lib/api-base.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, '.mobile-build')
const flag = process.argv.indexOf('--api-base-url')
const apiBase = validateApiBase(flag >= 0 ? process.argv[flag + 1] : process.env.NEXT_PUBLIC_API_BASE_URL)

// Stage only frontend sources: never move live API routes or copy environment secrets.
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const name of ['app', 'components', 'hooks', 'lib', 'public', 'package.json', 'tsconfig.json', 'postcss.config.mjs', 'next-env.d.ts']) {
  await cp(path.join(root, name), path.join(target, name), {
    recursive: true,
    filter: source => source !== path.join(root, 'app/api') && source !== path.join(root, 'public/sw.js'),
  })
}
await symlink(path.join(root, 'node_modules'), path.join(target, 'node_modules'), 'dir')
await writeFile(path.join(target, 'next.config.mjs'), `export default { output: 'export', images: { unoptimized: true }, turbopack: { root: ${JSON.stringify(root)} } }\n`)
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build', target], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_APP_TARGET: 'mobile', NEXT_PUBLIC_API_BASE_URL: apiBase },
})
if (result.status !== 0) process.exit(result.status ?? 1)
await access(path.join(target, 'out/index.html'))
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(path.join(target, 'out/mobile-build.json'), JSON.stringify({ app: manifest.name, version: manifest.version, apiBase }, null, 2))
console.log(`Android assets: .mobile-build/out (backend: ${apiBase}). Run pnpm cap:sync next.`)
