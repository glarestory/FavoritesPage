// 즐겨찾기 아이콘 후보 생성, 회색 기본 아이콘 감지, 모노그램 생성 및 커스텀 아이콘 검증 모듈입니다.

import {
  ALLOWED_LOCAL_IMAGE_MIME_TYPES,
  inferImageMimeFromName,
} from './background-image.mjs'

export const FAVORITE_ICON_ACCEPT = ALLOWED_LOCAL_IMAGE_MIME_TYPES.join(',')

// 즐겨찾기 로컬 아이콘 원본 최대 파일 크기 (5MB)
export const MAX_FAVORITE_ICON_FILE_BYTES = 5 * 1024 * 1024

// localStorage·JSON 백업 용량 부담을 줄이기 위한 즐겨찾기 아이콘 Data URL 최대 길이 (~80KB)
export const MAX_FAVORITE_ICON_DATA_URL_LENGTH = 80_000

// 즐겨찾기 아이콘 리사이즈 목표 크기 (128x128px)
export const MAX_FAVORITE_ICON_DIMENSION = 128

// 이모지 아이콘 문자열 최대 코드 유닛 길이 (ZWJ 복합 이모지 포함)
export const MAX_ICON_EMOJI_LENGTH = 16

export const PRESET_ICON_EMOJIS = [
  '🌐',
  '⭐',
  '💼',
  '🛠️',
  '💻',
  '🤖',
  '📰',
  '🛒',
  '📚',
  '🎵',
  '🎮',
  '📊',
  '🔒',
  '☁️',
  '📁',
  '🚀',
]

const LOCAL_ICON_DATA_URL_PATTERN =
  /^data:image\/(?:jpeg|png|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/

const CJK_OR_HANGUL_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/

/**
 * 사내망, 로컬호스트, 사설 IP 등 외부 favicon 서비스가 접근할 수 없는 호스트인지 판별합니다.
 */
export function isPrivateOrLocalHostname(hostname) {
  if (typeof hostname !== 'string') return true
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true

  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home')
  ) {
    return true
  }

  // IPv6 로컬/링크로컬 주소
  if (host.includes(':')) {
    return (
      host === '::' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    )
  }

  // 점이 없는 단일 호스트명(예: intranet, nas)
  if (!host.includes('.')) return true

  // IPv4 주소 검사
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4Match) {
    const a = Number(ipv4Match[1])
    const b = Number(ipv4Match[2])
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }

  return false
}

/**
 * 즐겨찾기 아이콘으로 시도할 후보 URL 목록을 우선순위대로 생성합니다.
 */
export function buildFaviconCandidates({ url, iconUrl }) {
  const candidates = []
  const seen = new Set()

  const addCandidate = (candidateUrl, kind) => {
    if (!candidateUrl || seen.has(candidateUrl)) return
    seen.add(candidateUrl)
    candidates.push({ url: candidateUrl, kind })
  }

  if (typeof iconUrl === 'string' && iconUrl.trim()) {
    addCandidate(iconUrl.trim(), 'custom')
  }

  if (typeof url === 'string' && url.trim()) {
    const trimmed = url.trim()
    const normalized = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`

    try {
      const parsed = new URL(normalized)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const isLocal = isPrivateOrLocalHostname(parsed.hostname)
        if (!isLocal) {
          addCandidate(
            `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`,
            'google',
          )
          addCandidate(
            `https://icons.duckduckgo.com/ip3/${encodeURIComponent(parsed.hostname)}.ico`,
            'duckduckgo',
          )
        }
        addCandidate(`${parsed.origin}/favicon.ico`, 'origin')
      }
    } catch {
      // 잘못된 URL이면 후보를 추가하지 않고 모노그램 아바타로 폴백합니다.
    }
  }

  return candidates
}

/**
 * 로드된 이미지가 Google S2의 기본 회색 지구본(16x16) 등 플레이스홀더인지 판별합니다.
 */
export function isLikelyPlaceholderIcon(kind, naturalWidth, naturalHeight) {
  const width = Number(naturalWidth) || 0
  const height = Number(naturalHeight) || 0
  if (width <= 0 || height <= 0) return true

  // Google S2에 sz=128을 요청했을 때 16x16 이하가 오면 대부분 기본 회색 지구본입니다.
  if (kind === 'google' && width <= 16 && height <= 16) {
    return true
  }

  return false
}

/**
 * 아이콘이 없을 때 표시할 1~2글자 모노그램을 생성합니다.
 * - 한글/CJK 이름은 깔끔한 1글자
 * - 영문/숫자 이름은 카멜케이스·다단어 약어 또는 앞 2글자 대문자
 */
export function getSiteMonogram(name, url = '') {
  const raw = typeof name === 'string' ? name.trim() : ''
  let source = raw

  if (!source && typeof url === 'string' && url.trim()) {
    try {
      const normalized = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url.trim())
        ? url.trim()
        : `https://${url.trim()}`
      const host = new URL(normalized).hostname.replace(/^www\./i, '')
      source = host.split('.')[0] || host
    } catch {
      source = ''
    }
  }

  if (!source) return '?'

  const firstChar = Array.from(source)[0] ?? '?'
  if (CJK_OR_HANGUL_PATTERN.test(firstChar)) {
    return firstChar
  }

  // 영문/숫자 단어 추출
  const words = source
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[\s._\-/+]+/)
    .map((part) => part.replace(/[^a-zA-Z\d]/g, ''))
    .filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  if (words.length === 1) {
    const token = words[0]
    return token.slice(0, Math.min(2, token.length)).toUpperCase()
  }

  return firstChar.toUpperCase()
}

/**
 * 이모지 아이콘 문자열을 정규화합니다.
 */
export function normalizeIconEmoji(value) {
  if (typeof value !== 'string') return undefined
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  if (!cleaned) return undefined

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
    const segments = Array.from(segmenter.segment(cleaned), (item) => item.segment)
      .filter((segment) => segment.trim().length > 0)
    const first = segments[0]
    if (!first || first.length > MAX_ICON_EMOJI_LENGTH) return undefined
    return first
  }

  return cleaned.slice(0, MAX_ICON_EMOJI_LENGTH)
}

/**
 * 로컬 아이콘용 Data URL인지 확인합니다.
 */
export function isLocalIconDataUrl(value) {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_FAVORITE_ICON_DATA_URL_LENGTH) return false
  return LOCAL_ICON_DATA_URL_PATTERN.test(value)
}

/**
 * 로컬 아이콘용 Data URL을 검증합니다.
 */
export function validateLocalIconDataUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: '아이콘 이미지 데이터가 비어 있습니다.' }
  }

  const trimmed = value.trim()
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    return { ok: false, error: 'SVG 이미지는 보안상 아이콘으로 사용할 수 없습니다.' }
  }

  if (trimmed.length > MAX_FAVORITE_ICON_DATA_URL_LENGTH) {
    return { ok: false, error: '아이콘 이미지 용량이 너무 큽니다. 더 작은 이미지를 선택해 주세요.' }
  }

  if (!LOCAL_ICON_DATA_URL_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: '지원하지 않는 아이콘 이미지 형식입니다. JPG, PNG, WebP, GIF, AVIF 형식만 사용할 수 있습니다.',
    }
  }

  return { ok: true, value: trimmed }
}

/**
 * 즐겨찾기 로컬 아이콘 업로드 파일의 메타데이터를 검증합니다.
 */
export function validateLocalIconFileMeta(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: '아이콘 이미지 파일을 선택해 주세요.' }
  }

  const rawType = typeof file.type === 'string' ? file.type.trim().toLowerCase() : ''
  const mime = rawType || inferImageMimeFromName(file.name)

  if (mime === 'image/svg+xml') {
    return {
      ok: false,
      error: 'SVG 파일은 보안상 아이콘으로 사용할 수 없습니다. PNG, JPG, WebP 등의 이미지를 선택해 주세요.',
    }
  }

  if (!ALLOWED_LOCAL_IMAGE_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      error: 'JPG, PNG, WebP, GIF, AVIF 형식의 이미지 파일만 선택할 수 있습니다.',
    }
  }

  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: '비어 있거나 읽을 수 없는 이미지 파일입니다.' }
  }

  if (file.size > MAX_FAVORITE_ICON_FILE_BYTES) {
    return {
      ok: false,
      error: `아이콘 파일은 최대 ${Math.round(MAX_FAVORITE_ICON_FILE_BYTES / (1024 * 1024))}MB까지 선택할 수 있습니다.`,
    }
  }

  return { ok: true, mime }
}
