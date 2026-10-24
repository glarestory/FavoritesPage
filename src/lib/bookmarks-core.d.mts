export const MAX_IMPORTED_BOOKMARKS: number
export const MAX_FAVORITES: number
export const MAX_CATEGORIES: number
export const MAX_TITLE_LENGTH: number
export const MAX_CATEGORY_NAME_LENGTH: number
export const ALL_CATEGORY_LABEL: string

export interface ParsedBookmark {
  key: string
  title: string
  url: string
  canonicalUrl: string
  folderPath: string[]
  folderName: string | null
  createdAt: number | null
  warning: string | null
}

export interface RejectedBookmark {
  title: string
  url: string
  folderPath: string[]
  reason: string
}

export interface ParsedBookmarkFile {
  items: ParsedBookmark[]
  rejected: RejectedBookmark[]
  totalCandidates: number
  truncated: boolean
}

export interface BookmarkPlanFavorite {
  id: string
  name: string
  url: string
  categoryId: string
  createdAt: number
  iconUrl?: string
}

export interface BookmarkPlanCategory {
  id: string
  name: string
}

export interface BookmarkPlanStats {
  selected: number
  added: number
  updated: number
  skippedDuplicateExisting: number
  skippedDuplicateFile: number
  skippedInvalid: number
  categoriesCreated: number
  fallbackCount: number
  truncatedCategoryNames: number
}

export interface BookmarkCategoryPlanEntry {
  id: string
  name: string
  isNew: boolean
  count: number
}

export interface BookmarkPlan {
  favorites: BookmarkPlanFavorite[]
  categories: BookmarkPlanCategory[]
  stats: BookmarkPlanStats
  categoryPlan: BookmarkCategoryPlanEntry[]
}

export type BookmarkPlanResult =
  | { ok: true; value: BookmarkPlan }
  | { ok: false; error: string }

export type DuplicatePolicy = 'skip' | 'replace'

export interface BookmarkPlanInput {
  items: ParsedBookmark[]
  favorites: BookmarkPlanFavorite[]
  categories: BookmarkPlanCategory[]
  useFolders?: boolean
  duplicatePolicy?: DuplicatePolicy
  createCategoryId?: (prefix?: string) => string
  createFavoriteId?: (prefix?: string) => string
  now?: number
}

export function decodeHtmlEntities(value: unknown): string
export function validateBookmarkUrl(raw: unknown): { ok: true; value: string } | { ok: false; error: string }
export function canonicalBookmarkUrl(raw: unknown): string
export function getBookmarkCategoryName(folderName: string | null | undefined): string | null
export function parseChromeBookmarksHtml(text: string): ParsedBookmarkFile
export function planBookmarkImport(input: BookmarkPlanInput): BookmarkPlanResult
