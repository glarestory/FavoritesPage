// Chrome 확장 빌드 산출물(dist-extension)에 manifest.json과 아이콘 PNG 파일을 복사합니다.

import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const extensionDir = path.resolve(rootDir, 'extension')
const targetDir = path.resolve(rootDir, 'dist-extension')

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(
  path.join(extensionDir, 'manifest.json'),
  path.join(targetDir, 'manifest.json'),
)

const sourceIconsDir = path.join(extensionDir, 'icons')
const targetIconsDir = path.join(targetDir, 'icons')
fs.mkdirSync(targetIconsDir, { recursive: true })

for (const fileName of fs.readdirSync(sourceIconsDir)) {
  if (!fileName.endsWith('.png')) continue
  fs.copyFileSync(
    path.join(sourceIconsDir, fileName),
    path.join(targetIconsDir, fileName),
  )
}

console.log('Copied Chrome extension manifest and icons into dist-extension/')
