import type { BackupFile, BackgroundSettings, Category, Favorite, Settings } from '../types'
import { GRADIENT_PRESETS } from './background'
import {
  ALL_CATEGORY_ID,
  ALL_CATEGORY_LABEL,
  createDefaultCategories,
  getFallbackCategoryId,
  inferCategoryId,
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryId,
  normalizeCategoryName,
} from './categories'
import { createDefaultSettings } from './defaults'
import { normalizePageTitle } from './page-titles.mjs'
import { createId } from './id'
import { getSearchEngine } from './search'
import { canonicalUrl, validateWebUrl } from './url'

const BACKUP_VERSION = 2
const APP_ID = 'my-start-page'
const MAX_IMPORTED_FAVORITES = 300

export interface ImportedData {
  favorites: Favorite[]
  categories?: Category[]
  settings?: Settings
}

export type ImportResult =
  | { ok: true; value: ImportedData }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseImportedCategories(raw: unknown): Category[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: '카테고리 목록(categories)이 배열 형식이 아닙니다.' }
  }
  if (raw.length === 0) {
    return { error: '백업 파일에 카테고리가 하나 이상 있어야 합니다.' }
  }
  if (raw.length > MAX_CATEGORIES) {
    return { error: `카테고리는 한 번에 ${MAX_CATEGORIES}개까지 가져올 수 있습니다.` }
  }

  const categories: Category[] = []
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()

  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index]
    const position = index + 1
    if (!isRecord(entry)) {
      return { error: `${position}번째 카테고리 항목이 객체 형식이 아닙니다.` }
    }

    const name = normalizeCategoryName(
      typeof entry.name === 'string' ? entry.name : '',
    )
    if (!name) {
      return { error: `${position}번째 카테고리에 이름이 없습니다.` }
    }
    if (name.length > MAX_CATEGORY_NAME_LENGTH) {
      return {
        error: `${position}번째 카테고리 이름이 너무 깁니다. (최대 ${MAX_CATEGORY_NAME_LENGTH}자)`,
      }
    }
    if (name === ALL_CATEGORY_LABEL) {
      return { error: `“${ALL_CATEGORY_LABEL}”는 카테고리 이름으로 사용할 수 없습니다.` }
    }

    const nameKey = name.toLocaleLowerCase()
    if (usedNames.has(nameKey)) {
      return { error: `카테고리 이름이 중복되었습니다: ${name}` }
    }

    const rawId = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (rawId && !normalizeCategoryId(rawId)) {
      return { error: `${position}번째 카테고리 ID 형식이 올바르지 않습니다.` }
    }
    const id = normalizeCategoryId(rawId) ?? createId('category')
    if (id === ALL_CATEGORY_ID) {
      return { error: `카테고리 ID로 “${ALL_CATEGORY_ID}”을 사용할 수 없습니다.` }
    }
    if (usedIds.has(id)) {
      return { error: `카테고리 ID가 중복되었습니다: ${id}` }
    }

    usedIds.add(id)
    usedNames.add(nameKey)
    categories.push({ id, name })
  }

  return categories
}

function parseImportedFavorites(
  raw: unknown,
  categories?: Category[],
): { favorites: Favorite[] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: '즐겨찾기 목록(favorites)이 배열 형식이 아닙니다.' }
  }
  if (raw.length > MAX_IMPORTED_FAVORITES) {
    return { error: `즐겨찾기는 한 번에 ${MAX_IMPORTED_FAVORITES}개까지 가져올 수 있습니다.` }
  }

  const categoryPool = categories ?? createDefaultCategories()
  const categoryIds = new Set(categoryPool.map((category) => category.id))
  const fallbackCategoryId = getFallbackCategoryId(categoryPool)
  const favorites: Favorite[] = []
  const usedIds = new Set<string>()
  const usedUrls = new Map<string, string>()

  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index]
    const position = index + 1
    if (!isRecord(entry)) {
      return { error: `${position}번째 즐겨찾기 항목이 객체 형식이 아닙니다.` }
    }

    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) {
      return { error: `${position}번째 즐겨찾기에 사이트 이름이 없습니다.` }
    }
    if (name.length > 60) {
      return { error: `${position}번째 즐겨찾기의 이름이 너무 깁니다. (최대 60자)` }
    }

    if (typeof entry.url !== 'string') {
      return { error: `${position}번째 즐겨찾기(${name})에 URL이 없습니다.` }
    }
    const validatedUrl = validateWebUrl(entry.url)
    if (!validatedUrl.ok) {
      return { error: `${position}번째 즐겨찾기(${name}): ${validatedUrl.error}` }
    }

    const key = canonicalUrl(validatedUrl.value)
    if (usedUrls.has(key)) {
      return {
        error: `중복된 URL이 포함되어 있습니다: ${name} / ${usedUrls.get(key)}`,
      }
    }
    usedUrls.set(key, name)

    let iconUrl: string | undefined
    if (entry.iconUrl !== undefined && entry.iconUrl !== null && entry.iconUrl !== '') {
      if (typeof entry.iconUrl !== 'string') {
        return { error: `${position}번째 즐겨찾기(${name})의 아이콘 URL이 문자열이 아닙니다.` }
      }
      const validatedIcon = validateWebUrl(entry.iconUrl, '아이콘 URL')
      if (!validatedIcon.ok) {
        return { error: `${position}번째 즐겨찾기(${name}): ${validatedIcon.error}` }
      }
      iconUrl = validatedIcon.value
    }

    let id =
      typeof entry.id === 'string' && entry.id.trim().length > 0
        ? entry.id.trim().slice(0, 120)
        : createId()
    if (usedIds.has(id)) id = createId()
    usedIds.add(id)

    const rawCategoryId =
      typeof entry.categoryId === 'string' ? entry.categoryId.trim() : ''
    let categoryId: string

    if (rawCategoryId && categoryIds.has(rawCategoryId)) {
      categoryId = rawCategoryId
    } else if (rawCategoryId && categories) {
      return {
        error: `${position}번째 즐겨찾기(${name})에 알 수 없는 카테고리가 지정되어 있습니다.`,
      }
    } else {
      const inferred = inferCategoryId(validatedUrl.value)
      categoryId =
        inferred && categoryIds.has(inferred) ? inferred : fallbackCategoryId
    }

    const createdAt =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
        ? entry.createdAt
        : Date.now()

    favorites.push({
      id,
      name,
      url: validatedUrl.value,
      iconUrl,
      categoryId,
      createdAt,
    })
  }

  return { favorites }
}

function parseImportedBackground(raw: unknown): BackgroundSettings | { error: string } {
  if (raw === undefined || raw === null) return { type: 'default' }
  if (!isRecord(raw)) return { error: '배경 설정(background)이 객체 형식이 아닙니다.' }

  if (raw.type === 'default') return { type: 'default' }

  if (raw.type === 'color') {
    const color = typeof raw.color === 'string' ? raw.color.trim() : ''
    if (!/^#[\da-f]{6}$/i.test(color) && !/^#[\da-f]{3}$/i.test(color)) {
      return { error: '배경 색상은 #RRGGBB 형식의 색상 코드여야 합니다.' }
    }
    return { type: 'color', color }
  }

  if (raw.type === 'gradient') {
    const preset = GRADIENT_PRESETS.find((item) => item.id === raw.gradient)
    if (!preset) return { error: '알 수 없는 배경 그라데이션입니다.' }
    return { type: 'gradient', gradient: preset.id }
  }

  if (raw.type === 'image') {
    if (typeof raw.url !== 'string') {
      return { error: '배경 이미지 URL이 없습니다.' }
    }
    const validated = validateWebUrl(raw.url, '배경 이미지 URL')
    if (!validated.ok) return { error: validated.error }
    const overlay =
      typeof raw.overlay === 'number' && Number.isFinite(raw.overlay)
        ? Math.min(0.85, Math.max(0, raw.overlay))
        : 0.45
    return { type: 'image', url: validated.value, overlay }
  }

  return { error: '알 수 없는 배경 유형입니다.' }
}

function parseImportedSettings(raw: unknown): Settings | { error: string } | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) return { error: '설정(settings)이 객체 형식이 아닙니다.' }

  const defaults = createDefaultSettings()

  if (raw.theme !== undefined && raw.theme !== 'light' && raw.theme !== 'dark') {
    return { error: '테마는 light 또는 dark여야 합니다.' }
  }
  const theme = raw.theme === 'dark' ? 'dark' : 'light'

  if (raw.searchEngine !== undefined && typeof raw.searchEngine !== 'string') {
    return { error: '검색 엔진 설정이 올바르지 않습니다.' }
  }
  const searchEngine =
    typeof raw.searchEngine === 'string'
      ? getSearchEngine(raw.searchEngine as Settings['searchEngine']).id
      : defaults.searchEngine
  if (
    raw.searchEngine !== undefined &&
    !['google', 'bing', 'duckduckgo', 'naver'].includes(raw.searchEngine as string)
  ) {
    return { error: '지원하지 않는 검색 엔진입니다.' }
  }

  if (raw.openInNewTab !== undefined && typeof raw.openInNewTab !== 'boolean') {
    return { error: '새 탭 열기 설정은 true 또는 false여야 합니다.' }
  }

  if (raw.siteTitle !== undefined && typeof raw.siteTitle !== 'string') {
    return { error: '사이트 이름은 문자열이어야 합니다.' }
  }
  if (raw.heroTitle !== undefined && typeof raw.heroTitle !== 'string') {
    return { error: '메인 제목은 문자열이어야 합니다.' }
  }

  const background = parseImportedBackground(raw.background)
  if ('error' in background) return background

  return {
    theme,
    searchEngine,
    background,
    openInNewTab:
      typeof raw.openInNewTab === 'boolean' ? raw.openInNewTab : defaults.openInNewTab,
    siteTitle: normalizePageTitle(raw.siteTitle, defaults.siteTitle),
    heroTitle: normalizePageTitle(raw.heroTitle, defaults.heroTitle),
  }
}

export function parseBackup(text: string): ImportResult {
  if (!text.trim()) return { ok: false, error: '파일이 비어 있습니다.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON 파일을 해석할 수 없습니다. 올바른 백업 파일인지 확인해 주세요.' }
  }

  if (Array.isArray(parsed)) {
    const result = parseImportedFavorites(parsed)
    if ('error' in result) return { ok: false, error: result.error }
    return { ok: true, value: { favorites: result.favorites } }
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: '백업 파일의 최상위 값이 객체 또는 배열이어야 합니다.' }
  }

  if (parsed.app !== undefined && parsed.app !== APP_ID) {
    return { ok: false, error: '이 앱에서 만든 백업 파일이 아닙니다.' }
  }

  if (parsed.version !== undefined) {
    if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
      return { ok: false, error: '백업 파일의 버전 정보가 올바르지 않습니다.' }
    }
    if (parsed.version > BACKUP_VERSION) {
      return {
        ok: false,
        error: '이 백업 파일은 현재 앱보다 최신 버전입니다. 앱을 업데이트한 뒤 다시 시도해 주세요.',
      }
    }
  }

  let categories: Category[] | undefined
  if ('categories' in parsed) {
    const categoriesResult = parseImportedCategories(parsed.categories)
    if ('error' in categoriesResult) {
      return { ok: false, error: categoriesResult.error }
    }
    categories = categoriesResult
  }

  if (!('favorites' in parsed)) {
    return { ok: false, error: '백업 파일에 즐겨찾기 목록(favorites)이 없습니다.' }
  }

  const favoritesResult = parseImportedFavorites(parsed.favorites, categories)
  if ('error' in favoritesResult) return { ok: false, error: favoritesResult.error }

  const settingsResult = parseImportedSettings(parsed.settings)
  if (settingsResult && 'error' in settingsResult) {
    return { ok: false, error: settingsResult.error }
  }

  return {
    ok: true,
    value: {
      favorites: favoritesResult.favorites,
      ...(categories ? { categories } : {}),
      ...(settingsResult ? { settings: settingsResult } : {}),
    },
  }
}

export function serializeBackup(
  favorites: Favorite[],
  categories: Category[],
  settings: Settings,
): string {
  const backup: BackupFile = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    favorites,
    categories,
    settings,
  }
  return JSON.stringify(backup, null, 2)
}

export function downloadBackup(
  favorites: Favorite[],
  categories: Category[],
  settings: Settings,
): string {
  const date = new Date()
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  const filename = `my-start-page-backup-${datePart}.json`
  const blob = new Blob([serializeBackup(favorites, categories, settings)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
