import type { BackgroundSettings, Category, Favorite, Settings, WidgetData } from '../types'

export interface SyncableState {
  favorites: Favorite[]
  categories: Category[]
  settings: Settings
  widgets: WidgetData
}

export interface LocalMediaStore {
  localBackground: Extract<BackgroundSettings, { type: 'image' }> | null
  localFavoriteIcons: Record<string, string>
}

export interface DecodedSyncState {
  payload: Record<string, unknown>
  updatedAt: number
  clientId: string
  chunkCount: number
}

export declare const SYNC_META_KEY: string
export declare const SYNC_CHUNK_PREFIX: string
export declare const LOCAL_MEDIA_KEY: string
export declare const MAX_SYNC_CHUNK_BYTES: number
export declare const MAX_SYNC_TOTAL_BYTES: number
export declare const SYNC_SCHEMA_VERSION: number

export declare function getUtf8ByteLength(value: string): number
export declare function splitStateForChromeStorage(state: SyncableState): {
  syncPayload: SyncableState
  localMedia: LocalMediaStore
}
export declare function mergeChromeStorageState(
  syncPayload: Record<string, unknown>,
  localMedia: unknown,
): Record<string, unknown>
export declare function splitStringByUtf8Bytes(
  text: string,
  maxBytes?: number,
): string[]
export declare function encodeSyncChunks(
  payload: unknown,
  options?: {
    clientId?: string
    updatedAt?: number
    maxChunkBytes?: number
    maxTotalBytes?: number
  },
):
  | {
      ok: true
      items: Record<string, unknown>
      chunkCount: number
      totalBytes: number
    }
  | {
      ok: false
      error: string
      totalBytes: number
    }
export declare function decodeSyncChunks(
  storageItems: Record<string, unknown>,
): DecodedSyncState | null
export declare function getObsoleteChunkKeys(
  existingKeys: string[],
  nextChunkCount: number,
): string[]
