export type FaviconCandidateKind = 'custom' | 'google' | 'duckduckgo' | 'origin'

export interface FaviconCandidate {
  url: string
  kind: FaviconCandidateKind
}

export declare const FAVORITE_ICON_ACCEPT: string
export declare const MAX_FAVORITE_ICON_FILE_BYTES: number
export declare const MAX_FAVORITE_ICON_DATA_URL_LENGTH: number
export declare const MAX_FAVORITE_ICON_DIMENSION: number
export declare const MAX_ICON_EMOJI_LENGTH: number
export declare const PRESET_ICON_EMOJIS: readonly string[]

export declare function isPrivateOrLocalHostname(hostname: string): boolean
export declare function buildFaviconCandidates(favorite: {
  url?: string
  iconUrl?: string
}): FaviconCandidate[]
export declare function isLikelyPlaceholderIcon(
  kind: FaviconCandidateKind,
  naturalWidth: number,
  naturalHeight: number,
): boolean
export declare function getSiteMonogram(name: string, url?: string): string
export declare function normalizeIconEmoji(value: unknown): string | undefined
export declare function isLocalIconDataUrl(value: unknown): boolean
export declare function validateLocalIconDataUrl(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string }
export declare function validateLocalIconFileMeta(file: {
  type?: string
  size?: number
  name?: string
}): { ok: true; mime: string } | { ok: false; error: string }
