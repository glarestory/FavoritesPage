import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFaviconCandidates,
  getSiteMonogram,
  isLikelyPlaceholderIcon,
  isLocalIconDataUrl,
  isPrivateOrLocalHostname,
  MAX_FAVORITE_ICON_DATA_URL_LENGTH,
  MAX_FAVORITE_ICON_FILE_BYTES,
  normalizeIconEmoji,
  validateLocalIconDataUrl,
  validateLocalIconFileMeta,
} from '../src/lib/favorite-icon.mjs'

const SAMPLE_ICON_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII='

test('isPrivateOrLocalHostname detects localhost, private IPs, and internal hosts', () => {
  assert.equal(isPrivateOrLocalHostname('localhost'), true)
  assert.equal(isPrivateOrLocalHostname('app.localhost'), true)
  assert.equal(isPrivateOrLocalHostname('nas.local'), true)
  assert.equal(isPrivateOrLocalHostname('intranet'), true)
  assert.equal(isPrivateOrLocalHostname('127.0.0.1'), true)
  assert.equal(isPrivateOrLocalHostname('192.168.0.10'), true)
  assert.equal(isPrivateOrLocalHostname('10.0.1.5'), true)
  assert.equal(isPrivateOrLocalHostname('172.16.0.1'), true)
  assert.equal(isPrivateOrLocalHostname('[::1]'), true)

  assert.equal(isPrivateOrLocalHostname('github.com'), false)
  assert.equal(isPrivateOrLocalHostname('172.32.0.1'), false)
  assert.equal(isPrivateOrLocalHostname('naver.com'), false)
})

test('buildFaviconCandidates orders custom, google, duckduckgo, origin for public sites', () => {
  const candidates = buildFaviconCandidates({
    url: 'https://github.com/glarestory',
    iconUrl: 'https://example.com/custom.png',
  })
  assert.deepEqual(
    candidates.map((item) => item.kind),
    ['custom', 'google', 'duckduckgo', 'origin'],
  )
  assert.equal(candidates[3].url, 'https://github.com/favicon.ico')
})

test('buildFaviconCandidates skips external favicon APIs for local and private hosts', () => {
  const candidates = buildFaviconCandidates({
    url: 'http://192.168.0.50:8080/dashboard',
  })
  assert.deepEqual(candidates, [
    { url: 'http://192.168.0.50:8080/favicon.ico', kind: 'origin' },
  ])
})

test('isLikelyPlaceholderIcon flags 16x16 Google S2 default globe icons and broken images', () => {
  assert.equal(isLikelyPlaceholderIcon('google', 16, 16), true)
  assert.equal(isLikelyPlaceholderIcon('google', 128, 128), false)
  assert.equal(isLikelyPlaceholderIcon('origin', 16, 16), false)
  assert.equal(isLikelyPlaceholderIcon('custom', 0, 0), true)
})

test('getSiteMonogram produces 1-char CJK and 2-char Latin monograms', () => {
  assert.equal(getSiteMonogram('네이버'), '네')
  assert.equal(getSiteMonogram('사내 포털'), '사')
  assert.equal(getSiteMonogram('Google Drive'), 'GD')
  assert.equal(getSiteMonogram('GitHub'), 'GH')
  assert.equal(getSiteMonogram('Notion'), 'NO')
  assert.equal(getSiteMonogram('X'), 'X')
  assert.equal(getSiteMonogram('', 'https://www.example.com'), 'EX')
})

test('normalizeIconEmoji keeps a single grapheme cluster and strips empty/control values', () => {
  assert.equal(normalizeIconEmoji(' 🚀 '), '🚀')
  assert.equal(normalizeIconEmoji('🛠️'), '🛠️')
  assert.equal(normalizeIconEmoji('🔥⭐'), '🔥')
  assert.equal(normalizeIconEmoji('   '), undefined)
  assert.equal(normalizeIconEmoji(null), undefined)
})

test('validateLocalIconDataUrl and validateLocalIconFileMeta enforce type and size limits', () => {
  assert.equal(isLocalIconDataUrl(SAMPLE_ICON_PNG), true)
  assert.equal(validateLocalIconDataUrl(SAMPLE_ICON_PNG).ok, true)
  assert.equal(validateLocalIconDataUrl('data:image/svg+xml;base64,PHN2Zy8+').ok, false)
  assert.equal(
    validateLocalIconDataUrl(`data:image/png;base64,${'A'.repeat(MAX_FAVORITE_ICON_DATA_URL_LENGTH)}`)
      .ok,
    false,
  )

  assert.deepEqual(
    validateLocalIconFileMeta({ type: 'image/png', size: 1024, name: 'icon.png' }),
    { ok: true, mime: 'image/png' },
  )
  assert.equal(
    validateLocalIconFileMeta({ type: 'image/svg+xml', size: 512, name: 'icon.svg' }).ok,
    false,
  )
  assert.equal(
    validateLocalIconFileMeta({
      type: 'image/png',
      size: MAX_FAVORITE_ICON_FILE_BYTES + 1,
      name: 'huge.png',
    }).ok,
    false,
  )
})
