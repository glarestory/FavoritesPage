import type {
  BackgroundSettings,
  Category,
  Favorite,
  Settings,
  WidgetData,
} from '../types'
import { GRADIENT_PRESETS } from './background'
import {
  normalizeBackgroundFileName,
  validateLocalImageDataUrl,
} from './background-image.mjs'
import {
  normalizeIconEmoji,
  validateLocalIconDataUrl,
} from './favorite-icon.mjs'
import {
  createDefaultWidgetData,
  sanitizeWidgetData,
} from './widgets.mjs'
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
import { createDefaultSettings, DEFAULT_FAVORITES, STORAGE_KEYS } from './defaults'
import { normalizePageTitle } from './page-titles.mjs'
import { createId } from './id'
import { validateWebUrl } from './url'

export interface LoadResult<T> {
  value: T
  error: string | null
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    const probe = '__my_start_page_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface SanitizedFavorites {
  favorites: Favorite[]
  skipped: number
}

export function sanitizeFavorites(value: unknown[], categories: Category[]): SanitizedFavorites {
  const favorites: Favorite[] = []
  const usedIds = new Set<string>()
  const usedUrls = new Set<string>()
  const categoryList = categories.length > 0 ? categories : createDefaultCategories()
  const categoryIds = new Set(categoryList.map((category) => category.id))
  const fallbackCategoryId = getFallbackCategoryId(categoryList)
  let skipped = 0

  for (const entry of value.slice(0, 300)) {
    if (!isRecord(entry)) {
      skipped += 1
      continue
    }

    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 60) : ''
    const urlValue = typeof entry.url === 'string' ? entry.url : ''
    const validatedUrl = validateWebUrl(urlValue)
    if (!name || !validatedUrl.ok) {
      skipped += 1
      continue
    }

    const canonical = validatedUrl.value.replace(/\/+$/, '')
    if (usedUrls.has(canonical)) {
      skipped += 1
      continue
    }
    usedUrls.add(canonical)

    let id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : createId()
    if (usedIds.has(id)) id = createId()
    usedIds.add(id)

    let iconUrl: string | undefined
    if (typeof entry.iconUrl === 'string' && entry.iconUrl.trim()) {
      const trimmedIcon = entry.iconUrl.trim()
      if (trimmedIcon.startsWith('data:')) {
        const validatedLocalIcon = validateLocalIconDataUrl(trimmedIcon)
        if (validatedLocalIcon.ok) iconUrl = validatedLocalIcon.value
      } else {
        const validatedIcon = validateWebUrl(trimmedIcon, '아이콘 URL')
        if (validatedIcon.ok) iconUrl = validatedIcon.value
      }
    }

    const iconEmoji = normalizeIconEmoji(entry.iconEmoji)

    const rawCategoryId =
      typeof entry.categoryId === 'string' ? entry.categoryId.trim() : ''
    let categoryId = categoryIds.has(rawCategoryId) ? rawCategoryId : ''
    if (!categoryId) {
      if (rawCategoryId) {
        categoryId = fallbackCategoryId
      } else {
        const inferred = inferCategoryId(validatedUrl.value)
        categoryId =
          inferred && categoryIds.has(inferred) ? inferred : fallbackCategoryId
      }
    }

    const createdAt =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
        ? entry.createdAt
        : Date.now()

    favorites.push({
      id,
      name,
      url: validatedUrl.value,
      ...(iconUrl ? { iconUrl } : {}),
      ...(iconEmoji ? { iconEmoji } : {}),
      categoryId,
      createdAt,
    })
  }

  if (value.length > 300) skipped += value.length - 300

  return { favorites, skipped }
}

interface SanitizedCategories {
  categories: Category[]
  skipped: number
}

export function sanitizeCategories(value: unknown[]): SanitizedCategories {
  const categories: Category[] = []
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()
  let skipped = 0

  for (const entry of value.slice(0, MAX_CATEGORIES)) {
    if (!isRecord(entry)) {
      skipped += 1
      continue
    }

    const name = normalizeCategoryName(
      typeof entry.name === 'string' ? entry.name : '',
    )
    if (
      !name ||
      name.length > MAX_CATEGORY_NAME_LENGTH ||
      name === ALL_CATEGORY_LABEL
    ) {
      skipped += 1
      continue
    }

    const nameKey = name.toLocaleLowerCase()
    if (usedNames.has(nameKey)) {
      skipped += 1
      continue
    }

    let id = normalizeCategoryId(entry.id) ?? createId('category')
    if (id === ALL_CATEGORY_ID || usedIds.has(id)) id = createId('category')
    usedIds.add(id)
    usedNames.add(nameKey)
    categories.push({ id, name })
  }

  if (value.length > MAX_CATEGORIES) skipped += value.length - MAX_CATEGORIES

  return { categories, skipped }
}

function sanitizeBackground(value: unknown): BackgroundSettings {
  if (!isRecord(value)) return { type: 'default' }

  if (value.type === 'color') {
    const color = typeof value.color === 'string' ? value.color.trim() : ''
    if (/^#[\da-f]{6}$/i.test(color) || /^#[\da-f]{3}$/i.test(color)) {
      return { type: 'color', color }
    }
  }

  if (value.type === 'gradient') {
    const gradient = GRADIENT_PRESETS.find((preset) => preset.id === value.gradient)
    if (gradient) return { type: 'gradient', gradient: gradient.id }
  }

  if (value.type === 'image' && typeof value.url === 'string') {
    const overlay =
      typeof value.overlay === 'number' && Number.isFinite(value.overlay)
        ? Math.min(0.85, Math.max(0, value.overlay))
        : 0.45

    if (value.url.trim().startsWith('data:')) {
      const validatedLocal = validateLocalImageDataUrl(value.url)
      if (validatedLocal.ok) {
        const fileName = normalizeBackgroundFileName(value.fileName)
        return {
          type: 'image',
          url: validatedLocal.value,
          overlay,
          source: 'local',
          ...(fileName ? { fileName } : {}),
        }
      }
      return { type: 'default' }
    }

    const validated = validateWebUrl(value.url, '배경 이미지 URL')
    if (validated.ok) {
      return {
        type: 'image',
        url: validated.value,
        overlay,
        source: 'url',
      }
    }
  }

  return { type: 'default' }
}

export function sanitizeSettings(value: unknown): Settings {
  const defaults = createDefaultSettings()
  if (!isRecord(value)) return defaults

  const theme = value.theme === 'dark' ? 'dark' : 'light'
  const searchEngine =
    value.searchEngine === 'bing' ||
    value.searchEngine === 'duckduckgo' ||
    value.searchEngine === 'naver' ||
    value.searchEngine === 'google'
      ? value.searchEngine
      : defaults.searchEngine

  return {
    theme,
    searchEngine,
    background: sanitizeBackground(value.background),
    openInNewTab: typeof value.openInNewTab === 'boolean' ? value.openInNewTab : false,
    siteTitle: normalizePageTitle(value.siteTitle, defaults.siteTitle),
    heroTitle: normalizePageTitle(value.heroTitle, defaults.heroTitle),
    showSideWidgets:
      typeof value.showSideWidgets === 'boolean'
        ? value.showSideWidgets
        : defaults.showSideWidgets,
  }
}

export function loadCategories(): LoadResult<Category[]> {
  const storage = getStorage()
  if (!storage) {
    return {
      value: createDefaultCategories(),
      error:
        '브라우저 저장소를 사용할 수 없습니다. 카테고리 변경 사항은 이번 방문 동안에만 유지됩니다.',
    }
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEYS.categories)
  } catch {
    return {
      value: createDefaultCategories(),
      error: '저장된 카테고리를 읽지 못했습니다.',
    }
  }

  if (raw === null) {
    return { value: createDefaultCategories(), error: null }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {
        value: createDefaultCategories(),
        error: '카테고리 데이터 형식이 올바르지 않아 기본 카테고리를 불러왔습니다.',
      }
    }

    const sanitized = sanitizeCategories(parsed)
    if (sanitized.categories.length === 0) {
      return {
        value: createDefaultCategories(),
        error: '저장된 카테고리를 복구하지 못해 기본 카테고리를 불러왔습니다.',
      }
    }

    return {
      value: sanitized.categories,
      error:
        sanitized.skipped > 0
          ? `저장된 카테고리 ${sanitized.skipped}개를 읽지 못해 건너뛰었습니다.`
          : null,
    }
  } catch {
    return {
      value: createDefaultCategories(),
      error: '저장된 카테고리 데이터를 해석하지 못해 기본 카테고리를 불러왔습니다.',
    }
  }
}

export function loadFavorites(categories: Category[]): LoadResult<Favorite[]> {
  const storage = getStorage()
  if (!storage) {
    return {
      value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })),
      error:
        '브라우저 저장소를 사용할 수 없습니다. 변경 사항은 이번 방문 동안에만 유지됩니다.',
    }
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEYS.favorites)
  } catch {
    return { value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })), error: '저장된 즐겨찾기를 읽지 못했습니다.' }
  }

  if (raw === null) {
    return { value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })), error: null }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {
        value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })),
        error: '즐겨찾기 데이터 형식이 올바르지 않아 기본 즐겨찾기를 불러왔습니다.',
      }
    }

    const sanitized = sanitizeFavorites(parsed, categories)
    if (sanitized.skipped > 0 && sanitized.favorites.length === 0 && parsed.length > 0) {
      return {
        value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })),
        error: '저장된 즐겨찾기를 복구하지 못해 기본 즐겨찾기를 불러왔습니다.',
      }
    }

    return {
      value: sanitized.favorites,
      error:
        sanitized.skipped > 0
          ? `저장된 즐겨찾기 ${sanitized.skipped}개를 읽지 못해 건너뛰었습니다.`
          : null,
    }
  } catch {
    return {
      value: DEFAULT_FAVORITES.map((favorite) => ({ ...favorite })),
      error: '저장된 즐겨찾기 데이터를 해석하지 못해 기본 즐겨찾기를 불러왔습니다.',
    }
  }
}

export function loadSettings(): LoadResult<Settings> {
  const storage = getStorage()
  if (!storage) {
    return { value: createDefaultSettings(), error: null }
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEYS.settings)
  } catch {
    return { value: createDefaultSettings(), error: '저장된 설정을 읽지 못했습니다.' }
  }

  if (raw === null) return { value: createDefaultSettings(), error: null }

  try {
    const parsed: unknown = JSON.parse(raw)
    return { value: sanitizeSettings(parsed), error: null }
  } catch {
    return {
      value: createDefaultSettings(),
      error: '저장된 설정을 해석하지 못해 기본 설정을 적용했습니다.',
    }
  }
}

export function saveFavorites(favorites: Favorite[]): string | null {
  const storage = getStorage()
  if (!storage) return '브라우저 저장소를 사용할 수 없어 즐겨찾기가 저장되지 않았습니다.'
  try {
    storage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites))
    return null
  } catch {
    return '즐겨찾기를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}

export function saveCategories(categories: Category[]): string | null {
  const storage = getStorage()
  if (!storage) return '브라우저 저장소를 사용할 수 없어 카테고리가 저장되지 않았습니다.'
  try {
    storage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories))
    return null
  } catch {
    return '카테고리를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}

export function saveSettings(settings: Settings): string | null {
  const storage = getStorage()
  if (!storage) return '브라우저 저장소를 사용할 수 없어 설정이 저장되지 않았습니다.'
  try {
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
    return null
  } catch (error) {
    const isQuotaError =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    if (isQuotaError) {
      return '브라우저 저장 공간이 부족해 설정을 저장하지 못했습니다. 더 작은 배경 이미지를 선택해 주세요.'
    }
    return '설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}

export function loadWidgets(): LoadResult<WidgetData> {
  const storage = getStorage()
  if (!storage) {
    return { value: createDefaultWidgetData(), error: null }
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEYS.widgets)
  } catch {
    return {
      value: createDefaultWidgetData(),
      error: '저장된 위젯 데이터를 읽지 못했습니다.',
    }
  }

  if (raw === null) return { value: createDefaultWidgetData(), error: null }

  try {
    const parsed: unknown = JSON.parse(raw)
    return { value: sanitizeWidgetData(parsed), error: null }
  } catch {
    return {
      value: createDefaultWidgetData(),
      error: '저장된 위젯 데이터를 해석하지 못해 기본 상태로 복구했습니다.',
    }
  }
}

export function saveWidgets(widgets: WidgetData): string | null {
  const storage = getStorage()
  if (!storage) return '브라우저 저장소를 사용할 수 없어 위젯 데이터가 저장되지 않았습니다.'
  try {
    storage.setItem(STORAGE_KEYS.widgets, JSON.stringify(widgets))
    return null
  } catch {
    return '위젯 데이터를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'
  }
}
