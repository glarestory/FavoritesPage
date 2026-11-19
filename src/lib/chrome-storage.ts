import type { Category, Favorite, Settings, WidgetData } from '../types'
import { createDefaultCategories } from './categories'
import { createStarterFavorites } from './defaults'
import {
  decodeSyncChunks,
  encodeSyncChunks,
  getObsoleteChunkKeys,
  LOCAL_MEDIA_KEY,
  mergeChromeStorageState,
  splitStateForChromeStorage,
  SYNC_META_KEY,
} from './extension-sync-core.mjs'
import type { SyncableState } from './extension-sync-core.mjs'
import {
  sanitizeCategories,
  sanitizeFavorites,
  sanitizeSettings,
} from './storage'
import { sanitizeWidgetData } from './widgets.mjs'

interface ChromeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

interface ChromeStorageChange {
  oldValue?: unknown
  newValue?: unknown
}

interface ChromeStorageApi {
  sync: ChromeStorageArea
  local: ChromeStorageArea
  onChanged?: {
    addListener(
      listener: (
        changes: Record<string, ChromeStorageChange>,
        areaName: string,
      ) => void,
    ): void
    removeListener(
      listener: (
        changes: Record<string, ChromeStorageChange>,
        areaName: string,
      ) => void,
    ): void
  }
}

interface ChromeGlobal {
  storage?: ChromeStorageApi
}

function getChromeStorage(): ChromeStorageApi | null {
  if (typeof globalThis === 'undefined') return null
  const chromeObj = (globalThis as unknown as { chrome?: ChromeGlobal }).chrome
  if (!chromeObj?.storage?.sync || !chromeObj?.storage?.local) return null
  return chromeObj.storage
}

/**
 * 현재 페이지가 Chrome 확장 프로그램 환경(chrome.storage API 사용 가능)인지 확인합니다.
 */
export function isChromeExtensionEnvironment(): boolean {
  return getChromeStorage() !== null
}

export interface ChromeSyncLoadResult {
  found: boolean
  state?: SyncableState
  updatedAt?: number
  error: string | null
}

export interface ChromeSyncSaveResult {
  ok: boolean
  updatedAt?: number
  totalBytes?: number
  error: string | null
}

function sanitizeSyncedState(merged: Record<string, unknown>): SyncableState {
  const rawCategories = Array.isArray(merged.categories) ? merged.categories : []
  const sanitizedCategories = sanitizeCategories(rawCategories)
  const categories: Category[] =
    sanitizedCategories.categories.length > 0
      ? sanitizedCategories.categories
      : createDefaultCategories()

  const rawFavorites = Array.isArray(merged.favorites) ? merged.favorites : null
  const favorites: Favorite[] = rawFavorites
    ? sanitizeFavorites(rawFavorites, categories).favorites
    : createStarterFavorites()

  const settings: Settings = sanitizeSettings(merged.settings)
  const widgets: WidgetData = sanitizeWidgetData(merged.widgets)

  return { favorites, categories, settings, widgets }
}

/**
 * chrome.storage.sync(동기화 데이터)와 chrome.storage.local(로컬 배경·아이콘)을
 * 함께 읽어 병합·검증된 앱 상태를 반환합니다.
 */
export async function loadStateFromChromeStorage(): Promise<ChromeSyncLoadResult> {
  const storage = getChromeStorage()
  if (!storage) return { found: false, error: null }

  try {
    const [syncItems, localItems] = await Promise.all([
      storage.sync.get(null),
      storage.local.get(LOCAL_MEDIA_KEY),
    ])

    const decoded = decodeSyncChunks(syncItems)
    if (!decoded) {
      return { found: false, error: null }
    }

    const merged = mergeChromeStorageState(
      decoded.payload,
      localItems[LOCAL_MEDIA_KEY],
    )
    return {
      found: true,
      state: sanitizeSyncedState(merged),
      updatedAt: decoded.updatedAt,
      error: null,
    }
  } catch {
    return {
      found: false,
      error: 'Chrome 동기화 데이터를 불러오지 못했습니다. 이 기기의 데이터를 사용합니다.',
    }
  }
}

/**
 * 앱 상태를 동기화 영역(chrome.storage.sync)과 현재 기기 전용 영역(chrome.storage.local)으로
 * 분리해 저장합니다.
 */
export async function saveStateToChromeStorage(
  state: SyncableState,
  clientId: string,
): Promise<ChromeSyncSaveResult> {
  const storage = getChromeStorage()
  if (!storage) return { ok: false, error: null }

  const { syncPayload, localMedia } = splitStateForChromeStorage(state)
  const updatedAt = Date.now()

  try {
    await storage.local.set({ [LOCAL_MEDIA_KEY]: localMedia })
  } catch {
    return {
      ok: false,
      error: '로컬 배경/아이콘을 Chrome 확장 저장소에 저장하지 못했습니다.',
    }
  }

  const encoded = encodeSyncChunks(syncPayload, { clientId, updatedAt })
  if (!encoded.ok) {
    return {
      ok: false,
      totalBytes: encoded.totalBytes,
      error: encoded.error,
    }
  }

  try {
    const existing = await storage.sync.get(null)
    await storage.sync.set(encoded.items)

    const obsoleteKeys = getObsoleteChunkKeys(
      Object.keys(existing),
      encoded.chunkCount,
    )
    if (obsoleteKeys.length > 0) {
      await storage.sync.remove(obsoleteKeys)
    }

    return {
      ok: true,
      updatedAt,
      totalBytes: encoded.totalBytes,
      error: null,
    }
  } catch {
    return {
      ok: false,
      error: 'Chrome 계정 동기화 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
}

/**
 * 다른 PC나 다른 탭에서 발생한 chrome.storage.sync 변경을 구독합니다.
 */
export function subscribeChromeSyncChanges(
  clientId: string,
  onRemoteUpdate: (state: SyncableState, updatedAt: number) => void,
): () => void {
  const storage = getChromeStorage()
  if (!storage?.onChanged) return () => {}

  const listener = (
    changes: Record<string, ChromeStorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'sync') return
    const metaChange = changes[SYNC_META_KEY]
    if (!metaChange?.newValue || typeof metaChange.newValue !== 'object') return

    const newMeta = metaChange.newValue as { clientId?: string }
    // 현재 탭에서 저장한 변경 사항은 무시해 무한 동기화 루프를 방지합니다.
    if (newMeta.clientId === clientId) return

    void (async () => {
      const result = await loadStateFromChromeStorage()
      if (result.found && result.state) {
        onRemoteUpdate(result.state, result.updatedAt ?? Date.now())
      }
    })()
  }

  storage.onChanged.addListener(listener)
  return () => {
    storage.onChanged?.removeListener(listener)
  }
}
