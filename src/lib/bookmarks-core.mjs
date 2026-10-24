export const MAX_IMPORTED_BOOKMARKS = 2000
export const MAX_FAVORITES = 300
export const MAX_CATEGORIES = 30
export const MAX_TITLE_LENGTH = 60
export const MAX_CATEGORY_NAME_LENGTH = 20
export const ALL_CATEGORY_LABEL = '전체'

const NAMED_ENTITIES = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
})

const UUID_PREFIX = 'bookmark-import'

function fallbackId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createId(prefix = UUID_PREFIX) {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return fallbackId(prefix)
}

export function decodeHtmlEntities(value) {
  return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x'
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      if (Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return match
        }
      }
      return match
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ')
}

function cleanText(value) {
  return decodeHtmlEntities(stripTags(String(value ?? ''))).replace(/\s+/g, ' ').trim()
}

function normalizeCategoryName(value) {
  return cleanText(value)
}

function buildCategoryLabel(folderName) {
  let name = normalizeCategoryName(folderName)
  if (!name) return null

  let truncated = false
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    name = name.slice(0, MAX_CATEGORY_NAME_LENGTH).trim()
    truncated = true
  }
  if (name === ALL_CATEGORY_LABEL) {
    name = `${name} (북마크)`
    truncated = true
  }
  if (!name) return null

  return { name, truncated }
}

function findTagEnd(html, start) {
  let quote = ''
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index]
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '>') return index
  }
  return -1
}

function readClosingContent(html, start, tagName) {
  const pattern = new RegExp(`</${tagName}\\s*>`, 'ig')
  pattern.lastIndex = start
  const match = pattern.exec(html)
  if (!match) return { text: html.slice(start), end: html.length }
  return { text: html.slice(start, match.index), end: pattern.lastIndex }
}

function parseAttributes(raw) {
  const attributes = {}
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match
  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attributes[name] = decodeHtmlEntities(value)
  }
  return attributes
}

function parseAddDate(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const milliseconds = seconds * 1000
  return Number.isFinite(milliseconds) ? milliseconds : null
}

function normalizeTitle(rawTitle, fallbackHost) {
  let title = cleanText(rawTitle)
  let warning = null

  if (!title) {
    title = fallbackHost
    warning = '제목이 없어 도메인으로 대체했습니다.'
  }

  if (title.length > MAX_TITLE_LENGTH) {
    title = Array.from(title).slice(0, MAX_TITLE_LENGTH).join('').trim()
    warning = warning
      ? `${warning} 제목이 ${MAX_TITLE_LENGTH}자로 잘렸습니다.`
      : `제목이 ${MAX_TITLE_LENGTH}자로 잘렸습니다.`
  }

  return { title, warning }
}

export function validateBookmarkUrl(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { ok: false, error: 'URL이 비어 있습니다.' }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed
  try {
    parsed = new URL(withScheme)
  } catch {
    return { ok: false, error: '올바른 URL 형식이 아닙니다.' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'http:// 또는 https:// 주소만 가져올 수 있습니다.' }
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'URL에 사이트 주소(도메인)가 없습니다.' }
  }
  if (parsed.hostname.includes(' ') || parsed.hostname.endsWith('.')) {
    return { ok: false, error: 'URL의 사이트 주소가 올바르지 않습니다.' }
  }

  return { ok: true, value: parsed.href }
}

export function canonicalBookmarkUrl(raw) {
  const validated = validateBookmarkUrl(raw)
  if (!validated.ok) return ''

  const parsed = new URL(validated.value)
  const path = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`
}

export function getBookmarkCategoryName(folderName) {
  return buildCategoryLabel(folderName)?.name ?? null
}

export function parseChromeBookmarksHtml(text) {
  const source = String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')

  const items = []
  const rejected = []
  const folders = []
  let pendingFolder = null
  let totalCandidates = 0
  let truncated = false
  let cursor = 0

  while (cursor < source.length) {
    if (items.length >= MAX_IMPORTED_BOOKMARKS) {
      truncated = true
      break
    }

    const open = source.indexOf('<', cursor)
    if (open === -1) break

    const end = findTagEnd(source, open)
    if (end === -1) break

    const rawTag = source.slice(open + 1, end).trim()
    if (!rawTag || rawTag.startsWith('!') || rawTag.startsWith('?')) {
      cursor = end + 1
      continue
    }

    const isClosing = rawTag.startsWith('/')
    const content = isClosing ? rawTag.slice(1).trim() : rawTag
    const nameMatch = content.match(/^([a-zA-Z][a-zA-Z0-9:-]*)/)
    if (!nameMatch) {
      cursor = end + 1
      continue
    }

    const tagName = nameMatch[1].toLowerCase()
    const attributesRaw = content.slice(nameMatch[0].length)

    if (isClosing) {
      if (tagName === 'dl' && folders.length > 0) folders.pop()
      cursor = end + 1
      continue
    }

    if (tagName === 'h3') {
      const inner = readClosingContent(source, end + 1, 'h3')
      pendingFolder = cleanText(inner.text) || null
      cursor = inner.end
      continue
    }

    if (tagName === 'dl') {
      folders.push(pendingFolder)
      pendingFolder = null
      cursor = end + 1
      continue
    }

    if (tagName === 'a') {
      const attributes = parseAttributes(attributesRaw)
      const inner = readClosingContent(source, end + 1, 'a')
      const href = typeof attributes.href === 'string' ? attributes.href : ''
      const folderPath = folders.filter((folder) => typeof folder === 'string' && folder.length > 0)
      totalCandidates += 1

      const validated = validateBookmarkUrl(href)
      if (!validated.ok) {
        rejected.push({
          title: cleanText(inner.text) || '(제목 없음)',
          url: href,
          folderPath,
          reason: validated.error,
        })
        cursor = inner.end
        pendingFolder = null
        continue
      }

      const parsedUrl = new URL(validated.value)
      const fallbackHost = parsedUrl.hostname.replace(/^www\./i, '')
      const titleInfo = normalizeTitle(inner.text, fallbackHost)

      items.push({
        key: `bookmark-${items.length}`,
        title: titleInfo.title,
        url: validated.value,
        canonicalUrl: canonicalBookmarkUrl(validated.value),
        folderPath,
        folderName: folderPath.length > 0 ? folderPath[folderPath.length - 1] : null,
        createdAt: parseAddDate(attributes.add_date),
        warning: titleInfo.warning,
      })

      cursor = inner.end
      pendingFolder = null
      continue
    }

    cursor = end + 1
  }

  return {
    items,
    rejected,
    totalCandidates,
    truncated,
  }
}

export function planBookmarkImport({
  items,
  favorites,
  categories,
  useFolders = true,
  duplicatePolicy = 'skip',
  createCategoryId,
  createFavoriteId,
  now = Date.now(),
}) {
  const selectedItems = Array.isArray(items) ? items : []
  const currentFavorites = Array.isArray(favorites) ? favorites : []
  const currentCategories = Array.isArray(categories) ? categories : []
  const makeCategoryId = typeof createCategoryId === 'function' ? createCategoryId : createId
  const makeFavoriteId = typeof createFavoriteId === 'function' ? createFavoriteId : createId

  if (selectedItems.length === 0) {
    return { ok: false, error: '가져올 북마크를 하나 이상 선택해 주세요.' }
  }

  const existingByUrl = new Map()
  for (const favorite of currentFavorites) {
    const key = canonicalBookmarkUrl(favorite.url)
    if (key && !existingByUrl.has(key)) existingByUrl.set(key, favorite)
  }

  const seen = new Set()
  const effective = []
  let duplicateInFile = 0
  let duplicateExisting = 0
  let skippedInvalid = 0

  for (const item of selectedItems) {
    const validated = validateBookmarkUrl(item.url)
    if (!validated.ok) {
      skippedInvalid += 1
      continue
    }

    const key = canonicalBookmarkUrl(validated.value)
    if (!key) {
      skippedInvalid += 1
      continue
    }

    if (seen.has(key)) {
      duplicateInFile += 1
      continue
    }
    seen.add(key)

    const existing = existingByUrl.get(key) ?? null
    if (existing && duplicatePolicy !== 'replace') {
      duplicateExisting += 1
      continue
    }

    const parsedUrl = new URL(validated.value)
    const fallbackHost = parsedUrl.hostname.replace(/^www\./i, '')
    const titleInfo = normalizeTitle(item.title, fallbackHost)
    const folderName = typeof item.folderName === 'string' ? item.folderName : null

    effective.push({
      key,
      existing,
      item: {
        ...item,
        title: titleInfo.title,
        url: validated.value,
        canonicalUrl: key,
        folderName,
      },
    })
  }

  if (effective.length === 0) {
    if (duplicateExisting > 0) {
      return {
        ok: false,
        error:
          '선택한 항목이 모두 기존 즐겨찾기와 중복됩니다. 중복 처리 방법을 변경하거나 다른 항목을 선택해 주세요.',
      }
    }
    return { ok: false, error: '가져올 수 있는 항목이 없습니다.' }
  }

  const addedCount = effective.filter((entry) => !entry.existing).length
  if (currentFavorites.length + addedCount > MAX_FAVORITES) {
    const remaining = Math.max(0, MAX_FAVORITES - currentFavorites.length)
    return {
      ok: false,
      error: `즐겨찾기는 최대 ${MAX_FAVORITES}개까지 저장할 수 있습니다. 현재 ${currentFavorites.length}개이므로 새 항목은 ${remaining}개까지 가져올 수 있습니다.`,
    }
  }

  const nextFavorites = [...currentFavorites]
  const nextCategories = currentCategories.map((category) => ({
    id: category.id,
    name: category.name,
  }))
  const categoryByName = new Map()
  for (const category of nextCategories) {
    categoryByName.set(category.name.toLocaleLowerCase(), category)
  }

  let fallbackCategory = nextCategories.find((category) => category.id === 'etc') ?? nextCategories[0]
  if (!fallbackCategory) {
    fallbackCategory = { id: makeCategoryId('category'), name: '기타' }
    nextCategories.push(fallbackCategory)
    categoryByName.set('기타', fallbackCategory)
  }

  const existingCategoryIds = new Set(currentCategories.map((category) => category.id))
  const categoryStats = new Map()
  const truncatedCategoryNames = new Set()
  const categoryIdByKey = new Map()
  let fallbackCount = 0
  let categorySlots = Math.max(0, MAX_CATEGORIES - nextCategories.length)

  const markCategory = (categoryId) => {
    const category = nextCategories.find((entry) => entry.id === categoryId)
    const existingStat = categoryStats.get(categoryId)
    if (existingStat) {
      existingStat.count += 1
      return
    }
    categoryStats.set(categoryId, {
      id: categoryId,
      name: category?.name ?? '',
      isNew: !existingCategoryIds.has(categoryId),
      count: 1,
    })
  }

  for (const entry of effective) {
    let categoryId = fallbackCategory.id
    const folderName = entry.item.folderName

    if (useFolders && folderName) {
      const label = buildCategoryLabel(folderName)
      if (label) {
        if (label.truncated) truncatedCategoryNames.add(label.name)

        const existingCategory = categoryByName.get(label.name.toLocaleLowerCase())
        if (existingCategory) {
          categoryId = existingCategory.id
        } else if (categorySlots > 0) {
          const newCategory = { id: makeCategoryId('category'), name: label.name }
          nextCategories.push(newCategory)
          categoryByName.set(label.name.toLocaleLowerCase(), newCategory)
          categorySlots -= 1
          categoryId = newCategory.id
        } else {
          fallbackCount += 1
        }
      }
    }

    categoryIdByKey.set(entry.key, categoryId)
    markCategory(categoryId)
  }

  const indexByUrl = new Map()
  nextFavorites.forEach((favorite, index) => {
    const key = canonicalBookmarkUrl(favorite.url)
    if (key && !indexByUrl.has(key)) indexByUrl.set(key, index)
  })

  let added = 0
  let updated = 0

  for (const entry of effective) {
    const categoryId = categoryIdByKey.get(entry.key) ?? fallbackCategory.id

    if (entry.existing) {
      const index = indexByUrl.get(entry.key)
      if (index === undefined) {
        skippedInvalid += 1
        continue
      }
      nextFavorites[index] = {
        ...nextFavorites[index],
        name: entry.item.title,
        url: entry.item.url,
        categoryId,
      }
      updated += 1
      continue
    }

    nextFavorites.push({
      id: makeFavoriteId('favorite'),
      name: entry.item.title,
      url: entry.item.url,
      categoryId,
      createdAt: Number.isFinite(entry.item.createdAt) ? entry.item.createdAt : now + added,
    })
    indexByUrl.set(entry.key, nextFavorites.length - 1)
    added += 1
  }

  return {
    ok: true,
    value: {
      favorites: nextFavorites,
      categories: nextCategories,
      stats: {
        selected: selectedItems.length,
        added,
        updated,
        skippedDuplicateExisting: duplicateExisting,
        skippedDuplicateFile: duplicateInFile,
        skippedInvalid,
        categoriesCreated: nextCategories.length - currentCategories.length,
        fallbackCount,
        truncatedCategoryNames: truncatedCategoryNames.size,
      },
      categoryPlan: [...categoryStats.values()],
    },
  }
}
