export type SyncAction = 'none' | 'pull' | 'push' | 'conflict'

export interface SyncMetaShape {
  fingerprint: string
  remoteVersion: number
  syncedAt: string
}

export function canonicalize(value: unknown): unknown

export function fingerprintSyncData(data: unknown): string

export function normalizeSyncData<
  T extends {
    favorites: unknown[]
    categories: unknown[]
    settings: unknown
  },
>(
  data: T,
): {
  favorites: T['favorites']
  categories: T['categories']
  settings: T['settings']
}

export function decideSyncAction(input: {
  localFingerprint: string
  remoteFingerprint: string
  lastFingerprint: string | null
}): SyncAction

export function parseSyncMeta(value: unknown): SyncMetaShape | null
