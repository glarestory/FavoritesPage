import type { Favorite } from '../types'

const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/

export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`
}

export type UrlValidation = { ok: true; value: string } | { ok: false; error: string }

export function validateWebUrl(raw: string, label = '사이트 URL'): UrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: `${label}을 입력해 주세요.` }
  }

  let parsed: URL
  try {
    parsed = new URL(normalizeUrlInput(trimmed))
  } catch {
    return { ok: false, error: '올바른 URL 형식이 아닙니다. 예: https://example.com' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `${label}은 http:// 또는 https:// 주소만 사용할 수 있습니다.` }
  }

  if (!parsed.hostname) {
    return { ok: false, error: 'URL에 사이트 주소(도메인)가 필요합니다.' }
  }

  if (parsed.hostname.includes(' ') || parsed.hostname.endsWith('.')) {
    return { ok: false, error: '올바른 도메인 주소를 입력해 주세요.' }
  }

  return { ok: true, value: parsed.href }
}

export function canonicalUrl(raw: string): string {
  const validation = validateWebUrl(raw)
  if (!validation.ok) return ''
  const parsed = new URL(validation.value)
  const path = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`
}

export function isDuplicateUrl(raw: string, favorites: Favorite[], excludeId?: string): boolean {
  const key = canonicalUrl(raw)
  if (!key) return false
  return favorites.some(
    (favorite) => favorite.id !== excludeId && canonicalUrl(favorite.url) === key,
  )
}

export function getHostname(raw: string): string {
  try {
    return new URL(normalizeUrlInput(raw)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function getSiteInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return Array.from(trimmed)[0]!.toUpperCase()
}

export interface AvatarTone {
  background: string
  color: string
}

const AVATAR_TONES: AvatarTone[] = [
  { background: '#e7efff', color: '#2563eb' },
  { background: '#fde9ea', color: '#dc2626' },
  { background: '#fdf1dc', color: '#b45309' },
  { background: '#e6f6ec', color: '#15803d' },
  { background: '#f3e9ff', color: '#7e22ce' },
  { background: '#e2f5f8', color: '#0e7490' },
  { background: '#ffe9f2', color: '#be185d' },
  { background: '#eceae4', color: '#57534e' },
]

export function getAvatarTone(seed: string): AvatarTone {
  let hash = 0
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!
}

export function getFaviconSources(favorite: Pick<Favorite, 'url' | 'iconUrl'>): string[] {
  const sources: string[] = []
  if (favorite.iconUrl) sources.push(favorite.iconUrl)

  try {
    const parsed = new URL(normalizeUrlInput(favorite.url))
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      sources.push(
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`,
      )
      sources.push(`${parsed.origin}/favicon.ico`)
    }
  } catch {
    // An invalid URL simply falls back to the letter avatar.
  }

  return Array.from(new Set(sources))
}
