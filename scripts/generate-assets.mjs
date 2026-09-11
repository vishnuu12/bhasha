import sharp from 'sharp'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public/mozhi-icon-source.png')
const output = path.join(root, 'public/icons')
await mkdir(output, { recursive: true })
for (const size of [32, 180, 192, 512]) {
  await sharp(source).resize(size, size).png().toFile(path.join(output, `mozhi-${size}.png`))
}
const res = path.join(root, 'android/app/src/main/res')
for (const [density, size, foregroundSize] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  const dir = path.join(res, `mipmap-${density}`)
  await mkdir(dir, { recursive: true })
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await sharp(source).resize(size, size).png().toFile(path.join(dir, `${name}.png`))
  }
  await sharp(source).resize(foregroundSize, foregroundSize).png().toFile(path.join(dir, 'ic_launcher_foreground.png'))
}
for (const directory of await readdir(res)) {
  if (!directory.startsWith('drawable') || directory.endsWith('v24')) continue
  const dir = path.join(res, directory)
  if (!(await readdir(dir)).includes('splash.png')) continue
  const landscape = directory.includes('land')
  const width = landscape ? 1280 : 720
  const height = landscape ? 720 : 1280
  const icon = await sharp(source).resize(160, 160).png().toBuffer()
  const label = await sharp({ text: { text: 'Mozhi', font: 'sans 42', rgba: true } }).png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background: '#f6f8f7' } })
    .composite([{ input: icon, left: Math.round((width - 160) / 2), top: Math.round(height / 2 - 115) }, { input: label, gravity: 'center', top: Math.round(height / 2 + 65), left: Math.round((width - (await sharp(label).metadata()).width) / 2) }])
    .png().toFile(path.join(dir, 'splash.png'))
}
console.log('Generated Mozhi PWA, launcher, and splash assets.')
