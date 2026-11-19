import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeResizedDimensions,
  formatFileSize,
  getBackgroundImageSource,
  inferImageMimeFromName,
  isLocalImageDataUrl,
  MAX_BACKGROUND_FILE_NAME_LENGTH,
  MAX_LOCAL_IMAGE_DATA_URL_LENGTH,
  MAX_LOCAL_IMAGE_FILE_BYTES,
  normalizeBackgroundFileName,
  validateLocalImageDataUrl,
  validateLocalImageFileMeta,
} from '../src/lib/background-image.mjs'

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII='

test('validateLocalImageDataUrl accepts allowed raster image data URLs', () => {
  const result = validateLocalImageDataUrl(SAMPLE_PNG_DATA_URL)
  assert.equal(result.ok, true)
  assert.equal(result.value, SAMPLE_PNG_DATA_URL)
  assert.equal(isLocalImageDataUrl(SAMPLE_PNG_DATA_URL), true)
})

test('validateLocalImageDataUrl rejects SVG, non-image, malformed, and oversized data URLs', () => {
  const svg = validateLocalImageDataUrl('data:image/svg+xml;base64,PHN2Zy8+')
  assert.equal(svg.ok, false)
  assert.match(svg.error, /SVG/)

  const html = validateLocalImageDataUrl('data:text/html;base64,PGgxPkhlbGxvPC9oMT4=')
  assert.equal(html.ok, false)

  const injected = validateLocalImageDataUrl(`${SAMPLE_PNG_DATA_URL}");background:red`)
  assert.equal(injected.ok, false)

  const oversized = validateLocalImageDataUrl(
    `data:image/jpeg;base64,${'A'.repeat(MAX_LOCAL_IMAGE_DATA_URL_LENGTH)}`,
  )
  assert.equal(oversized.ok, false)
  assert.match(oversized.error, /용량/)
})

test('validateLocalImageFileMeta validates mime, extension fallback, SVG rejection, and file size', () => {
  assert.deepEqual(
    validateLocalImageFileMeta({ type: 'image/webp', size: 1024, name: 'bg.webp' }),
    { ok: true, mime: 'image/webp' },
  )

  // File.type이 비어 있는 환경에서는 확장자에서 MIME을 보조 추론합니다.
  assert.deepEqual(
    validateLocalImageFileMeta({ type: '', size: 2048, name: 'wallpaper.JPG' }),
    { ok: true, mime: 'image/jpeg' },
  )

  const svgByMime = validateLocalImageFileMeta({
    type: 'image/svg+xml',
    size: 500,
    name: 'icon.svg',
  })
  assert.equal(svgByMime.ok, false)
  assert.match(svgByMime.error, /SVG/)

  const svgByExt = validateLocalImageFileMeta({
    type: '',
    size: 500,
    name: 'icon.svg',
  })
  assert.equal(svgByExt.ok, false)

  const emptyFile = validateLocalImageFileMeta({
    type: 'image/png',
    size: 0,
    name: 'empty.png',
  })
  assert.equal(emptyFile.ok, false)

  const tooBig = validateLocalImageFileMeta({
    type: 'image/jpeg',
    size: MAX_LOCAL_IMAGE_FILE_BYTES + 1,
    name: 'huge.jpg',
  })
  assert.equal(tooBig.ok, false)

  const unsupported = validateLocalImageFileMeta({
    type: 'application/pdf',
    size: 1000,
    name: 'doc.pdf',
  })
  assert.equal(unsupported.ok, false)
})

test('inferImageMimeFromName handles uppercase and unknown extensions', () => {
  assert.equal(inferImageMimeFromName('Photo.AVIF'), 'image/avif')
  assert.equal(inferImageMimeFromName('no-extension'), '')
})

test('normalizeBackgroundFileName strips control characters and clamps length', () => {
  assert.equal(normalizeBackgroundFileName('  my\n\twallpaper.jpg  '), 'my wallpaper.jpg')
  assert.equal(normalizeBackgroundFileName('   '), undefined)
  assert.equal(normalizeBackgroundFileName(null), undefined)

  const longName = `${'a'.repeat(MAX_BACKGROUND_FILE_NAME_LENGTH + 20)}.png`
  assert.equal(normalizeBackgroundFileName(longName)?.length, MAX_BACKGROUND_FILE_NAME_LENGTH)
})

test('getBackgroundImageSource detects local and url sources including legacy data', () => {
  assert.equal(
    getBackgroundImageSource({ source: 'local', url: SAMPLE_PNG_DATA_URL }),
    'local',
  )
  assert.equal(getBackgroundImageSource({ url: SAMPLE_PNG_DATA_URL }), 'local')
  assert.equal(getBackgroundImageSource({ url: 'https://example.com/bg.jpg' }), 'url')
})

test('computeResizedDimensions scales down proportionally without upscaling small images', () => {
  assert.deepEqual(computeResizedDimensions(3840, 2160, 1920), {
    width: 1920,
    height: 1080,
    resized: true,
  })
  assert.deepEqual(computeResizedDimensions(1080, 2160, 1920), {
    width: 960,
    height: 1920,
    resized: true,
  })
  assert.deepEqual(computeResizedDimensions(1280, 720, 1920), {
    width: 1280,
    height: 720,
    resized: false,
  })
})

test('formatFileSize formats bytes, kilobytes, and megabytes', () => {
  assert.equal(formatFileSize(512), '512 B')
  assert.equal(formatFileSize(256 * 1024), '256 KB')
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB')
})
