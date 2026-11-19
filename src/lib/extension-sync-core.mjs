// Chrome 확장 chrome.storage.sync(100KB, 항목당 8KB) + chrome.storage.local 분리/병합 및 청킹 로직입니다.

import { getBackgroundImageSource } from './background-image.mjs'

export const SYNC_META_KEY = 'msp_sync_meta_v1'
export const SYNC_CHUNK_PREFIX = 'msp_sync_chunk_'
export const LOCAL_MEDIA_KEY = 'msp_local_media_v1'

// chrome.storage.sync 한도(항목당 8,192B / 총 102,400B)에 여유 마진을 둔 안전 기준
export const MAX_SYNC_CHUNK_BYTES = 6_800
export const MAX_SYNC_TOTAL_BYTES = 96_000
export const SYNC_SCHEMA_VERSION = 1

const utf8Encoder = new TextEncoder()

/**
 * 문자열의 UTF-8 바이트 길이를 계산합니다.
 */
export function getUtf8ByteLength(value) {
  return utf8Encoder.encode(value).length
}

/**
 * 전체 앱 상태를 Chrome 계정 동기화 대상(syncPayload)과
 * 현재 기기 전용 대용량 미디어(localMedia: 로컬 배경 이미지·로컬 아이콘)로 분리합니다.
 */
export function splitStateForChromeStorage({ favorites, categories, settings, widgets }) {
  const localFavoriteIcons = {}
  const syncFavorites = favorites.map((favorite) => {
    if (typeof favorite.iconUrl === 'string' && favorite.iconUrl.startsWith('data:')) {
      localFavoriteIcons[favorite.id] = favorite.iconUrl
      const { iconUrl: _omitted, ...rest } = favorite
      return rest
    }
    return favorite
  })

  let localBackground = null
  let syncSettings = settings

  if (
    settings.background &&
    settings.background.type === 'image' &&
    getBackgroundImageSource(settings.background) === 'local'
  ) {
    localBackground = { ...settings.background }
    syncSettings = {
      ...settings,
      background: { type: 'default' },
    }
  }

  return {
    syncPayload: {
      favorites: syncFavorites,
      categories,
      settings: syncSettings,
      widgets,
    },
    localMedia: {
      localBackground,
      localFavoriteIcons,
    },
  }
}

/**
 * 동기화된 상태(syncPayload)에 현재 기기의 로컬 배경 이미지와 로컬 아이콘을 병합합니다.
 */
export function mergeChromeStorageState(syncPayload, localMedia) {
  const safeMedia =
    localMedia && typeof localMedia === 'object' ? localMedia : {}
  const localIcons =
    safeMedia.localFavoriteIcons && typeof safeMedia.localFavoriteIcons === 'object'
      ? safeMedia.localFavoriteIcons
      : {}

  const mergedFavorites = Array.isArray(syncPayload.favorites)
    ? syncPayload.favorites.map((favorite) => {
        if (
          favorite &&
          typeof favorite === 'object' &&
          !favorite.iconUrl &&
          !favorite.iconEmoji &&
          typeof localIcons[favorite.id] === 'string'
        ) {
          return { ...favorite, iconUrl: localIcons[favorite.id] }
        }
        return favorite
      })
    : []

  let mergedSettings = syncPayload.settings
  if (
    mergedSettings &&
    typeof mergedSettings === 'object' &&
    mergedSettings.background &&
    mergedSettings.background.type === 'default' &&
    safeMedia.localBackground &&
    typeof safeMedia.localBackground === 'object' &&
    safeMedia.localBackground.type === 'image'
  ) {
    mergedSettings = {
      ...mergedSettings,
      background: { ...safeMedia.localBackground },
    }
  }

  return {
    favorites: mergedFavorites,
    categories: syncPayload.categories,
    settings: mergedSettings,
    widgets: syncPayload.widgets,
  }
}

/**
 * JSON 직렬화된 문자열을 UTF-8 바이트 한도 이내의 안전한 청크 배열로 분할합니다.
 * 멀티바이트(한글·이모지) 문자가 청크 경계에서 잘리지 않도록 코드포인트 단위로 자릅니다.
 */
export function splitStringByUtf8Bytes(text, maxBytes = MAX_SYNC_CHUNK_BYTES) {
  if (!text) return ['']
  const limit = Math.max(64, maxBytes)
  const chunks = []
  let current = ''
  let currentBytes = 0

  for (const char of text) {
    const charBytes = getUtf8ByteLength(char)
    if (currentBytes + charBytes > limit && current.length > 0) {
      chunks.push(current)
      current = char
      currentBytes = charBytes
    } else {
      current += char
      currentBytes += charBytes
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

/**
 * 동기화 페이로드를 chrome.storage.sync에 저장할 청크 딕셔너리로 인코딩합니다.
 */
export function encodeSyncChunks(
  payload,
  {
    clientId,
    updatedAt = Date.now(),
    maxChunkBytes = MAX_SYNC_CHUNK_BYTES,
    maxTotalBytes = MAX_SYNC_TOTAL_BYTES,
  } = {},
) {
  const serialized = JSON.stringify(payload)
  const payloadBytes = getUtf8ByteLength(serialized)

  if (payloadBytes > maxTotalBytes) {
    return {
      ok: false,
      error:
        'Chrome 동기화 용량 한도(약 100KB)를 초과했습니다. 긴 메모나 불필요한 즐겨찾기를 정리해 주세요.',
      totalBytes: payloadBytes,
    }
  }

  const chunks = splitStringByUtf8Bytes(serialized, maxChunkBytes)
  const items = {
    [SYNC_META_KEY]: {
      version: SYNC_SCHEMA_VERSION,
      chunkCount: chunks.length,
      updatedAt,
      clientId: typeof clientId === 'string' ? clientId : '',
    },
  }

  let totalBytes = getUtf8ByteLength(SYNC_META_KEY) + getUtf8ByteLength(JSON.stringify(items[SYNC_META_KEY]))
  for (let index = 0; index < chunks.length; index += 1) {
    const key = `${SYNC_CHUNK_PREFIX}${index}`
    items[key] = chunks[index]
    totalBytes += getUtf8ByteLength(key) + getUtf8ByteLength(JSON.stringify(chunks[index]))
  }

  if (totalBytes > maxTotalBytes) {
    return {
      ok: false,
      error:
        'Chrome 동기화 용량 한도(약 100KB)를 초과했습니다. 긴 메모나 불필요한 즐겨찾기를 정리해 주세요.',
      totalBytes,
    }
  }

  return {
    ok: true,
    items,
    chunkCount: chunks.length,
    totalBytes,
  }
}

/**
 * chrome.storage.sync에서 읽은 전체 항목에서 청크를 합쳐 페이로드를 복원합니다.
 */
export function decodeSyncChunks(storageItems) {
  if (!storageItems || typeof storageItems !== 'object') return null
  const meta = storageItems[SYNC_META_KEY]
  if (
    !meta ||
    typeof meta !== 'object' ||
    typeof meta.chunkCount !== 'number' ||
    !Number.isInteger(meta.chunkCount) ||
    meta.chunkCount <= 0
  ) {
    return null
  }

  let combined = ''
  for (let index = 0; index < meta.chunkCount; index += 1) {
    const chunk = storageItems[`${SYNC_CHUNK_PREFIX}${index}`]
    if (typeof chunk !== 'string') return null
    combined += chunk
  }

  try {
    const payload = JSON.parse(combined)
    if (!payload || typeof payload !== 'object') return null
    return {
      payload,
      updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : 0,
      clientId: typeof meta.clientId === 'string' ? meta.clientId : '',
      chunkCount: meta.chunkCount,
    }
  } catch {
    return null
  }
}

/**
 * 청크 개수가 줄어들었을 때 제거해야 할 이전 청크 키 목록을 반환합니다.
 */
export function getObsoleteChunkKeys(existingKeys, nextChunkCount) {
  const obsolete = []
  for (const key of existingKeys) {
    if (!key.startsWith(SYNC_CHUNK_PREFIX)) continue
    const suffix = key.slice(SYNC_CHUNK_PREFIX.length)
    const index = Number(suffix)
    if (Number.isInteger(index) && index >= nextChunkCount) {
      obsolete.push(key)
    }
  }
  return obsolete
}
