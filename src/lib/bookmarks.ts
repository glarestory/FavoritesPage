import type { Category, Favorite } from '../types'
import {
  canonicalBookmarkUrl,
  parseChromeBookmarksHtml,
  planBookmarkImport as planBookmarkImportCore,
} from './bookmarks-core.mjs'
import type {
  BookmarkCategoryPlanEntry,
  BookmarkPlanStats,
  ParsedBookmark,
  RejectedBookmark,
} from './bookmarks-core.mjs'
import { createId } from './id'

export type {
  BookmarkCategoryPlanEntry,
  BookmarkPlanStats,
  ParsedBookmark,
  RejectedBookmark,
} from './bookmarks-core.mjs'

export interface BookmarkImportItem extends ParsedBookmark {
  duplicateOf: Favorite | null
  duplicateInFile: boolean
}

export interface BookmarkImportPreview {
  items: BookmarkImportItem[]
  rejected: RejectedBookmark[]
  totalCandidates: number
  truncated: boolean
  duplicatesWithExisting: number
  duplicatesInFile: number
}

export type BookmarkPreviewResult =
  | { ok: true; value: BookmarkImportPreview }
  | { ok: false; error: string }

export interface BookmarkImportRequest {
  items: BookmarkImportItem[]
  useFolders: boolean
  duplicatePolicy: 'skip' | 'replace'
}

export type BookmarkImportOutcome =
  | { ok: true; stats: BookmarkPlanStats }
  | { ok: false; error: string }

export type BookmarkPlanResult =
  | {
      ok: true
      value: {
        favorites: Favorite[]
        categories: Category[]
        stats: BookmarkPlanStats
        categoryPlan: BookmarkCategoryPlanEntry[]
      }
    }
  | { ok: false; error: string }

export function parseBookmarksForImport(
  text: string,
  favorites: Favorite[],
): BookmarkPreviewResult {
  let parsed
  try {
    parsed = parseChromeBookmarksHtml(text)
  } catch {
    return {
      ok: false,
      error: '북마크 HTML 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.',
    }
  }

  if (parsed.items.length === 0) {
    const firstIssue = parsed.rejected[0]
    return {
      ok: false,
      error: firstIssue
        ? `가져올 수 있는 북마크가 없습니다. ${firstIssue.reason}`
        : 'Chrome 북마크 HTML 파일에서 북마크를 찾지 못했습니다. Chrome에서 내보낸 HTML 파일인지 확인해 주세요.',
    }
  }

  const existingByUrl = new Map<string, Favorite>()
  for (const favorite of favorites) {
    const key = canonicalBookmarkUrl(favorite.url)
    if (key && !existingByUrl.has(key)) existingByUrl.set(key, favorite)
  }

  const seen = new Set<string>()
  let duplicatesWithExisting = 0
  let duplicatesInFile = 0

  const items = parsed.items.map((item) => {
    const duplicateInFile = seen.has(item.canonicalUrl)
    seen.add(item.canonicalUrl)

    const duplicateOf = existingByUrl.get(item.canonicalUrl) ?? null
    if (duplicateOf) duplicatesWithExisting += 1
    if (duplicateInFile) duplicatesInFile += 1

    return {
      ...item,
      duplicateOf,
      duplicateInFile,
    }
  })

  return {
    ok: true,
    value: {
      items,
      rejected: parsed.rejected,
      totalCandidates: parsed.totalCandidates,
      truncated: parsed.truncated,
      duplicatesWithExisting,
      duplicatesInFile,
    },
  }
}

export function planBookmarkImport(
  request: BookmarkImportRequest,
  favorites: Favorite[],
  categories: Category[],
): BookmarkPlanResult {
  return planBookmarkImportCore({
    items: request.items,
    favorites,
    categories,
    useFolders: request.useFolders,
    duplicatePolicy: request.duplicatePolicy,
    createCategoryId: (prefix = 'category') => createId(prefix),
    createFavoriteId: (prefix = 'favorite') => createId(prefix),
  })
}
