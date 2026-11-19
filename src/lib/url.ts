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
  gradient: string
  color: string
  border: string
}

const AVATAR_TONES: AvatarTone[] = [
  {
    background: '#e7efff',
    gradient: 'linear-gradient(145deg, #f2f6ff 0%, #dce8ff 100%)',
    color: '#2563eb',
    border: 'rgba(37, 99, 235, 0.16)',
  },
  {
    background: '#fde9ea',
    gradient: 'linear-gradient(145deg, #fff2f3 0%, #fbd9dc 100%)',
    color: '#dc2626',
    border: 'rgba(220, 38, 38, 0.16)',
  },
  {
    background: '#fdf1dc',
    gradient: 'linear-gradient(145deg, #fff8eb 0%, #fae6c3 100%)',
    color: '#b45309',
    border: 'rgba(180, 83, 9, 0.16)',
  },
  {
    background: '#e6f6ec',
    gradient: 'linear-gradient(145deg, #f2fbf5 0%, #d6f1e0 100%)',
    color: '#15803d',
    border: 'rgba(21, 128, 61, 0.16)',
  },
  {
    background: '#f3e9ff',
    gradient: 'linear-gradient(145deg, #f9f3ff 0%, #e7d6ff 100%)',
    color: '#7e22ce',
    border: 'rgba(126, 34, 206, 0.16)',
  },
  {
    background: '#e2f5f8',
    gradient: 'linear-gradient(145deg, #effbfc 0%, #cdeef3 100%)',
    color: '#0e7490',
    border: 'rgba(14, 116, 144, 0.16)',
  },
  {
    background: '#ffe9f2',
    gradient: 'linear-gradient(145deg, #fff3f8 0%, #ffd8e8 100%)',
    color: '#be185d',
    border: 'rgba(190, 24, 93, 0.16)',
  },
  {
    background: '#eceae4',
    gradient: 'linear-gradient(145deg, #f6f4ef 0%, #e3dfd6 100%)',
    color: '#57534e',
    border: 'rgba(87, 83, 78, 0.16)',
  },
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
