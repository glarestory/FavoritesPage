import { randomUUID } from 'node:crypto'

export const MAX_FAVORITES = 300
export const MAX_CATEGORIES = 30
export const MAX_CATEGORY_NAME_LENGTH = 20
export const MAX_URL_LENGTH = 2048
export const SCHEMA_VERSION = 1

export const DEFAULT_CATEGORIES = [
  { id: 'dev', name: '개발' },
  { id: 'ai', name: 'AI' },
  { id: 'work', name: '업무' },
  { id: 'news', name: '뉴스' },
  { id: 'shopping', name: '쇼핑' },
  { id: 'etc', name: '기타' },
]

const DEFAULT_CATEGORY_ID = 'etc'
const ALL_CATEGORY_ID = 'all'
const ALL_CATEGORY_LABEL = '전체'
const CATEGORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/
const SEARCH_ENGINES = new Set(['google', 'bing', 'duckduckgo', 'naver'])
const GRADIENTS = new Set(['daylight', 'mist', 'mint', 'lavender', 'midnight', 'graphite'])

const DEFAULT_SETTINGS = {
  theme: 'light',
  searchEngine: 'google',
  background: { type: 'default' },
  openInNewTab: false,
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCategoryName(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
}

function normalizeCategoryId(raw) {
  if (typeof raw !== 'string') return null
  const id = raw.trim()
  return CATEGORY_ID_PATTERN.test(id) ? id : null
}

function validateHttpUrl(raw, label) {
  if (typeof raw !== 'string') {
    return { ok: false, error: `${label}을 입력해 주세요.` }
  }

  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: `${label}이 올바르지 않습니다.` }
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: `${label}이 올바른 URL 형식이 아닙니다.` }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `${label}은 http:// 또는 https:// 주소여야 합니다.` }
  }
  if (!parsed.hostname || parsed.hostname.includes(' ')) {
    return { ok: false, error: `${label}에 올바른 호스트가 필요합니다.` }
  }

  return { ok: true, value: parsed.href }
}

function canonicalUrl(raw) {
  try {
    const parsed = new URL(raw)
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`
  } catch {
    return ''
  }
}

function createDefaultCategories() {
  return DEFAULT_CATEGORIES.map((category) => ({ ...category }))
}

function createDefaultSettings() {
  return { ...DEFAULT_SETTINGS, background: { ...DEFAULT_SETTINGS.background } }
}

function sanitizeBackground(value) {
  if (!isRecord(value)) return { type: 'default' }

  if (value.type === 'color') {
    const color = typeof value.color === 'string' ? value.color.trim() : ''
    if (/^#[\da-f]{6}$/i.test(color) || /^#[\da-f]{3}$/i.test(color)) {
      return { type: 'color', color }
    }
  }

  if (value.type === 'gradient' && typeof value.gradient === 'string') {
    if (GRADIENTS.has(value.gradient)) {
      return { type: 'gradient', gradient: value.gradient }
    }
  }

  if (value.type === 'image' && typeof value.url === 'string') {
    const validated = validateHttpUrl(value.url, '배경 이미지 URL')
    if (validated.ok) {
      const overlay =
        typeof value.overlay === 'number' && Number.isFinite(value.overlay)
          ? Math.min(0.85, Math.max(0, value.overlay))
          : 0.45
      return { type: 'image', url: validated.value, overlay }
    }
  }

  return { type: 'default' }
}

function sanitizeSettings(value) {
  const defaults = createDefaultSettings()
  if (!isRecord(value)) return defaults

  const theme = value.theme === 'dark' ? 'dark' : 'light'
  const searchEngine =
    typeof value.searchEngine === 'string' && SEARCH_ENGINES.has(value.searchEngine)
      ? value.searchEngine
      : defaults.searchEngine

  return {
    theme,
    searchEngine,
    background: sanitizeBackground(value.background),
    openInNewTab:
      typeof value.openInNewTab === 'boolean' ? value.openInNewTab : false,
  }
}

function validateSettingsStrict(value) {
  if (!isRecord(value)) {
    return { ok: false, error: '설정 데이터가 필요합니다.' }
  }
  if (value.theme !== 'light' && value.theme !== 'dark') {
    return { ok: false, error: '테마 설정이 올바르지 않습니다.' }
  }
  if (typeof value.searchEngine !== 'string' || !SEARCH_ENGINES.has(value.searchEngine)) {
    return { ok: false, error: '검색 엔진 설정이 올바르지 않습니다.' }
  }
  if (typeof value.openInNewTab !== 'boolean') {
    return { ok: false, error: '새 탭 설정이 올바르지 않습니다.' }
  }

  const background = value.background
  if (!isRecord(background)) {
    return { ok: false, error: '배경 설정이 올바르지 않습니다.' }
  }

  if (background.type === 'default') {
    return {
      ok: true,
      value: {
        theme: value.theme,
        searchEngine: value.searchEngine,
        background: { type: 'default' },
        openInNewTab: value.openInNewTab,
      },
    }
  }

  if (background.type === 'color') {
    const color = typeof background.color === 'string' ? background.color.trim() : ''
    if (!/^#[\da-f]{6}$/i.test(color) && !/^#[\da-f]{3}$/i.test(color)) {
      return { ok: false, error: '배경 색상이 올바르지 않습니다.' }
    }
    return {
      ok: true,
      value: {
        theme: value.theme,
        searchEngine: value.searchEngine,
        background: { type: 'color', color },
        openInNewTab: value.openInNewTab,
      },
    }
  }

  if (background.type === 'gradient') {
    if (typeof background.gradient !== 'string' || !GRADIENTS.has(background.gradient)) {
      return { ok: false, error: '배경 그라데이션이 올바르지 않습니다.' }
    }
    return {
      ok: true,
      value: {
        theme: value.theme,
        searchEngine: value.searchEngine,
        background: { type: 'gradient', gradient: background.gradient },
        openInNewTab: value.openInNewTab,
      },
    }
  }

  if (background.type === 'image') {
    const validated = validateHttpUrl(background.url, '배경 이미지 URL')
    if (!validated.ok) return validated
    if (
      typeof background.overlay !== 'number' ||
      !Number.isFinite(background.overlay) ||
      background.overlay < 0 ||
      background.overlay > 1
    ) {
      return { ok: false, error: '배경 이미지 투명도가 올바르지 않습니다.' }
    }
    return {
      ok: true,
      value: {
        theme: value.theme,
        searchEngine: value.searchEngine,
        background: {
          type: 'image',
          url: validated.value,
          overlay: Math.min(0.85, Math.max(0, background.overlay)),
        },
        openInNewTab: value.openInNewTab,
      },
    }
  }

  return { ok: false, error: '배경 설정 유형이 올바르지 않습니다.' }
}

export function validateSyncData(raw) {
  if (!isRecord(raw)) {
    return { ok: false, error: '동기화 데이터가 필요합니다.' }
  }

  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    return { ok: false, error: '카테고리가 하나 이상 필요합니다.' }
  }
  if (raw.categories.length > MAX_CATEGORIES) {
    return { ok: false, error: `카테고리는 ${MAX_CATEGORIES}개까지 저장할 수 있습니다.` }
  }

  const categories = []
  const categoryIds = new Set()
  const categoryNames = new Set()

  for (const entry of raw.categories) {
    if (!isRecord(entry)) {
      return { ok: false, error: '카테고리 형식이 올바르지 않습니다.' }
    }

    const id = normalizeCategoryId(entry.id)
    if (!id || id === ALL_CATEGORY_ID) {
      return { ok: false, error: '카테고리 ID가 올바르지 않습니다.' }
    }
    if (categoryIds.has(id)) {
      return { ok: false, error: '카테고리 ID가 중복되었습니다.' }
    }

    const name = normalizeCategoryName(entry.name)
    if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
      return {
        ok: false,
        error: `카테고리 이름은 1~${MAX_CATEGORY_NAME_LENGTH}자로 입력해 주세요.`,
      }
    }
    if (name === ALL_CATEGORY_LABEL) {
      return { ok: false, error: `"${ALL_CATEGORY_LABEL}"은 카테고리 이름으로 사용할 수 없습니다.` }
    }

    const nameKey = name.toLocaleLowerCase()
    if (categoryNames.has(nameKey)) {
      return { ok: false, error: '카테고리 이름이 중복되었습니다.' }
    }

    categoryIds.add(id)
    categoryNames.add(nameKey)
    categories.push({ id, name })
  }

  if (!Array.isArray(raw.favorites)) {
    return { ok: false, error: '즐겨찾기 데이터가 필요합니다.' }
  }
  if (raw.favorites.length > MAX_FAVORITES) {
    return { ok: false, error: `즐겨찾기는 ${MAX_FAVORITES}개까지 저장할 수 있습니다.` }
  }

  const favorites = []
  const favoriteIds = new Set()
  const favoriteUrls = new Set()

  for (const entry of raw.favorites) {
    if (!isRecord(entry)) {
      return { ok: false, error: '즐겨찾기 형식이 올바르지 않습니다.' }
    }

    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (!id || id.length > 200) {
      return { ok: false, error: '즐겨찾기 ID가 올바르지 않습니다.' }
    }
    if (favoriteIds.has(id)) {
      return { ok: false, error: '즐겨찾기 ID가 중복되었습니다.' }
    }

    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name || name.length > 60) {
      return { ok: false, error: '즐겨찾기 이름은 1~60자로 입력해 주세요.' }
    }

    const validatedUrl = validateHttpUrl(entry.url, '즐겨찾기 URL')
    if (!validatedUrl.ok) return validatedUrl

    const urlKey = canonicalUrl(validatedUrl.value)
    if (!urlKey || favoriteUrls.has(urlKey)) {
      return { ok: false, error: '같은 URL의 즐겨찾기가 중복되었습니다.' }
    }

    let iconUrl
    if (entry.iconUrl !== undefined && entry.iconUrl !== null && entry.iconUrl !== '') {
      const validatedIcon = validateHttpUrl(entry.iconUrl, '아이콘 URL')
      if (!validatedIcon.ok) return validatedIcon
      iconUrl = validatedIcon.value
    }

    const categoryId =
      typeof entry.categoryId === 'string' ? entry.categoryId.trim() : ''
    if (!categoryIds.has(categoryId)) {
      return { ok: false, error: '즐겨찾기의 카테고리가 존재하지 않습니다.' }
    }

    if (typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt)) {
      return { ok: false, error: '즐겨찾기 생성 시간이 올바르지 않습니다.' }
    }

    favoriteIds.add(id)
    favoriteUrls.add(urlKey)
    favorites.push({
      id,
      name,
      url: validatedUrl.value,
      ...(iconUrl ? { iconUrl } : {}),
      categoryId,
      createdAt: entry.createdAt,
    })
  }

  const settings = validateSettingsStrict(raw.settings)
  if (!settings.ok) return settings

  return {
    ok: true,
    value: {
      favorites,
      categories,
      settings: settings.value,
    },
  }
}

function normalizeCategoriesLenient(value) {
  const categories = []
  const usedIds = new Set()
  const usedNames = new Set()

  if (Array.isArray(value)) {
    for (const entry of value.slice(0, MAX_CATEGORIES)) {
      if (!isRecord(entry)) continue

      const name = normalizeCategoryName(entry.name)
      if (!name || name.length > MAX_CATEGORY_NAME_LENGTH || name === ALL_CATEGORY_LABEL) {
        continue
      }

      const nameKey = name.toLocaleLowerCase()
      if (usedNames.has(nameKey)) continue

      let id = normalizeCategoryId(entry.id) ?? randomUUID()
      if (id === ALL_CATEGORY_ID || usedIds.has(id)) id = randomUUID()

      usedIds.add(id)
      usedNames.add(nameKey)
      categories.push({ id, name })
    }
  }

  return categories.length > 0 ? categories : createDefaultCategories()
}

function normalizeFavoritesLenient(value, categories) {
  if (!Array.isArray(value)) return []

  const favorites = []
  const usedIds = new Set()
  const usedUrls = new Set()
  const categoryIds = new Set(categories.map((category) => category.id))
  const fallbackCategoryId = categoryIds.has(DEFAULT_CATEGORY_ID)
    ? DEFAULT_CATEGORY_ID
    : categories[0].id

  for (const entry of value.slice(0, MAX_FAVORITES)) {
    if (!isRecord(entry)) continue

    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 60) : ''
    if (!name) continue

    const validatedUrl = validateHttpUrl(entry.url, '즐겨찾기 URL')
    if (!validatedUrl.ok) continue

    const urlKey = canonicalUrl(validatedUrl.value)
    if (!urlKey || usedUrls.has(urlKey)) continue

    let id =
      typeof entry.id === 'string' && entry.id.trim().length > 0
        ? entry.id.trim()
        : randomUUID()
    if (id.length > 200 || usedIds.has(id)) id = randomUUID()

    let iconUrl
    if (typeof entry.iconUrl === 'string' && entry.iconUrl.trim()) {
      const validatedIcon = validateHttpUrl(entry.iconUrl, '아이콘 URL')
      if (validatedIcon.ok) iconUrl = validatedIcon.value
    }

    const rawCategoryId =
      typeof entry.categoryId === 'string' ? entry.categoryId.trim() : ''
    const categoryId = categoryIds.has(rawCategoryId)
      ? rawCategoryId
      : fallbackCategoryId

    const createdAt =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
        ? entry.createdAt
        : Date.now()

    usedIds.add(id)
    usedUrls.add(urlKey)
    favorites.push({
      id,
      name,
      url: validatedUrl.value,
      ...(iconUrl ? { iconUrl } : {}),
      categoryId,
      createdAt,
    })
  }

  return favorites
}

/**
 * Normalize data read from disk. This keeps an older or partially corrupt
 * store usable instead of failing the whole sync API.
 */
export function normalizeStoredSyncData(raw) {
  if (!isRecord(raw)) return null

  const source = isRecord(raw.data) && !Array.isArray(raw.favorites) ? raw.data : raw
  const categories = normalizeCategoriesLenient(source.categories)
  const favorites = normalizeFavoritesLenient(source.favorites, categories)
  const settings = sanitizeSettings(source.settings)
  const version =
    Number.isInteger(raw.version) && raw.version > 0 ? raw.version : 1
  const updatedAt =
    typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : new Date().toISOString()

  return {
    schemaVersion: SCHEMA_VERSION,
    version,
    updatedAt,
    favorites,
    categories,
    settings,
  }
}
