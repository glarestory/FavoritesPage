import type { Category, Favorite, Settings } from '../types'
import type { SyncData } from './api'
import {
  decideSyncAction,
  fingerprintSyncData,
  normalizeSyncData,
  parseSyncMeta,
} from './sync-core.mjs'

export const SYNC_META_KEY = 'my-start-page.sync.v1'
export const SYNC_SESSION_HINT_KEY = 'my-start-page.sync-session.v1'

export interface SyncMeta {
  fingerprint: string
  remoteVersion: number
  syncedAt: string
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function toSyncData(
  favorites: Favorite[],
  categories: Category[],
  settings: Settings,
): SyncData {
  return { favorites, categories, settings }
}

export function loadSyncMeta(): SyncMeta | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(SYNC_META_KEY)
    if (!raw) return null
    return parseSyncMeta(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(SYNC_META_KEY, JSON.stringify(meta))
  } catch {
    // Sync metadata is a convenience; localStorage may be full or disabled.
  }
}

export function clearSyncMeta(): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(SYNC_META_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function hasSessionHint(): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    return storage.getItem(SYNC_SESSION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export function setSessionHint(active: boolean): void {
  const storage = getStorage()
  if (!storage) return

  try {
    if (active) storage.setItem(SYNC_SESSION_HINT_KEY, '1')
    else storage.removeItem(SYNC_SESSION_HINT_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export { decideSyncAction, fingerprintSyncData, normalizeSyncData }
