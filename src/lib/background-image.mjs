// 로컬 배경 이미지 검증·정규화 및 리사이즈 치수 계산을 담당하는 공용 모듈입니다.

export const ALLOWED_LOCAL_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]

export const LOCAL_IMAGE_ACCEPT = ALLOWED_LOCAL_IMAGE_MIME_TYPES.join(',')

// 업로드할 수 있는 원본 로컬 파일 최대 크기 (20MB)
export const MAX_LOCAL_IMAGE_FILE_BYTES = 20 * 1024 * 1024

// localStorage 및 JSON 백업(최대 5MB)에 안전하게 저장할 수 있는 Data URL 최대 길이
export const MAX_LOCAL_IMAGE_DATA_URL_LENGTH = 1_800_000

// 리사이즈 시 긴 변의 최대 픽셀 크기
export const MAX_LOCAL_IMAGE_DIMENSION = 1920

// 작은 파일은 재인코딩 없이 원본 화질을 유지하기 위한 기준 길이 (~450KB)
export const PASS_THROUGH_DATA_URL_LENGTH = 600_000

export const MAX_BACKGROUND_FILE_NAME_LENGTH = 120

const LOCAL_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:jpeg|png|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/

const EXTENSION_TO_MIME = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
])

/**
 * 파일명 확장자에서 MIME 타입을 보조 추론합니다.
 * 일부 브라우저/OS에서 File.type이 비어 있는 경우를 보완합니다.
 */
export function inferImageMimeFromName(name) {
  if (typeof name !== 'string') return ''
  const lower = name.trim().toLowerCase()
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex < 0) return ''
  return EXTENSION_TO_MIME.get(lower.slice(dotIndex)) ?? ''
}

/**
 * 저장·표시용 파일명을 정리합니다.
 */
export function normalizeBackgroundFileName(value) {
  if (typeof value !== 'string') return undefined
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  if (!cleaned) return undefined
  return cleaned.slice(0, MAX_BACKGROUND_FILE_NAME_LENGTH)
}

/**
 * 허용된 래스터 이미지 형식의 base64 Data URL인지 확인합니다.
 */
export function isLocalImageDataUrl(value) {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_LOCAL_IMAGE_DATA_URL_LENGTH) return false
  return LOCAL_IMAGE_DATA_URL_PATTERN.test(value)
}

/**
 * 로컬 이미지 Data URL을 검증하고 오류 메시지를 반환합니다.
 */
export function validateLocalImageDataUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: '배경 이미지 데이터가 비어 있습니다.' }
  }

  const trimmed = value.trim()
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    return {
      ok: false,
      error: 'SVG 이미지는 보안상 배경 이미지로 사용할 수 없습니다.',
    }
  }

  if (trimmed.length > MAX_LOCAL_IMAGE_DATA_URL_LENGTH) {
    return {
      ok: false,
      error: '로컬 배경 이미지 용량이 너무 큽니다. 더 작은 이미지를 선택해 주세요.',
    }
  }

  if (!LOCAL_IMAGE_DATA_URL_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: '지원하지 않는 로컬 이미지 데이터 형식입니다. JPG, PNG, WebP, GIF, AVIF 형식만 사용할 수 있습니다.',
    }
  }

  return { ok: true, value: trimmed }
}

/**
 * 사용자가 선택한 로컬 파일의 메타데이터(형식·크기)를 검증합니다.
 */
export function validateLocalImageFileMeta(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: '이미지 파일을 선택해 주세요.' }
  }

  const rawType = typeof file.type === 'string' ? file.type.trim().toLowerCase() : ''
  const mime = rawType || inferImageMimeFromName(file.name)

  if (mime === 'image/svg+xml') {
    return {
      ok: false,
      error: 'SVG 파일은 보안상 배경으로 사용할 수 없습니다. JPG, PNG, WebP, GIF, AVIF 이미지를 선택해 주세요.',
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

  if (file.size > MAX_LOCAL_IMAGE_FILE_BYTES) {
    return {
      ok: false,
      error: `이미지 파일은 최대 ${Math.round(MAX_LOCAL_IMAGE_FILE_BYTES / (1024 * 1024))}MB까지 선택할 수 있습니다.`,
    }
  }

  return { ok: true, mime }
}

/**
 * 이미지 배경 설정의 출처('local' | 'url')를 판별합니다.
 * 이전 버전 데이터(source 없음)와도 호환됩니다.
 */
export function getBackgroundImageSource(background) {
  if (!background || typeof background !== 'object') return 'url'
  if (background.source === 'local') return 'local'
  if (typeof background.url === 'string' && background.url.startsWith('data:image/')) {
    return 'local'
  }
  return 'url'
}

/**
 * 원본 비율을 유지하면서 긴 변이 maxDimension 이하가 되도록 크기를 계산합니다.
 * 이미 기준 이하라면 확대하지 않고 원본 크기를 반환합니다.
 */
export function computeResizedDimensions(
  width,
  height,
  maxDimension = MAX_LOCAL_IMAGE_DIMENSION,
) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 0))
  const safeHeight = Math.max(1, Math.round(Number(height) || 0))
  const limit = Math.max(1, Math.round(Number(maxDimension) || MAX_LOCAL_IMAGE_DIMENSION))

  const longestSide = Math.max(safeWidth, safeHeight)
  if (longestSide <= limit) {
    return { width: safeWidth, height: safeHeight, resized: false }
  }

  const scale = limit / longestSide
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    resized: true,
  }
}

/**
 * 바이트 단위 크기를 읽기 쉬운 문자열로 변환합니다.
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
