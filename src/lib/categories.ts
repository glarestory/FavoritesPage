import type { Category, Favorite } from '../types'
import { createId } from './id'

export const ALL_CATEGORY_ID = 'all'
export const ALL_CATEGORY_LABEL = '전체'
export const DEFAULT_CATEGORY_ID = 'etc'
export const MAX_CATEGORY_NAME_LENGTH = 20
export const MAX_CATEGORIES = 30

const CATEGORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/

const DEFAULT_CATEGORY_DEFS: ReadonlyArray<Category> = [
  { id: 'dev', name: '개발' },
  { id: 'ai', name: 'AI' },
  { id: 'work', name: '업무' },
  { id: 'news', name: '뉴스' },
  { id: 'shopping', name: '쇼핑' },
  { id: DEFAULT_CATEGORY_ID, name: '기타' },
]

const CATEGORY_HOST_RULES: ReadonlyArray<{ categoryId: string; hosts: string[] }> = [
  {
    categoryId: 'dev',
    hosts: [
      'github.com',
      'gitlab.com',
      'stackoverflow.com',
      'developer.mozilla.org',
      'npmjs.com',
      'vercel.com',
      'netlify.com',
    ],
  },
  {
    categoryId: 'ai',
    hosts: [
      'chatgpt.com',
      'claude.ai',
      'gemini.google.com',
      'copilot.microsoft.com',
      'perplexity.ai',
      'huggingface.co',
      'openai.com',
    ],
  },
  {
    categoryId: 'work',
    hosts: [
      'mail.google.com',
      'drive.google.com',
      'docs.google.com',
      'notion.so',
      'slack.com',
      'trello.com',
      'asana.com',
      'office.com',
      'microsoft365.com',
    ],
  },
  {
    categoryId: 'news',
    hosts: [
      'news.naver.com',
      'naver.com',
      'nytimes.com',
      'bbc.com',
      'reuters.com',
      'hani.co.kr',
      'chosun.com',
      'yna.co.kr',
    ],
  },
  {
    categoryId: 'shopping',
    hosts: [
      'amazon.com',
      'coupang.com',
      '11st.co.kr',
      'gmarket.co.kr',
      'ebay.com',
      'aliexpress.com',
    ],
  },
]

export function createDefaultCategories(): Category[] {
  return DEFAULT_CATEGORY_DEFS.map((category) => ({ ...category }))
}

export function normalizeCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function normalizeCategoryId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim()
  return CATEGORY_ID_PATTERN.test(id) ? id : null
}

export function validateCategoryName(
  raw: string,
  categories: Category[],
  excludeId?: string,
): string | null {
  const name = normalizeCategoryName(raw)
  if (!name) return '카테고리 이름을 입력해 주세요.'
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    return `카테고리 이름은 ${MAX_CATEGORY_NAME_LENGTH}자까지 입력할 수 있습니다.`
  }
  if (name === ALL_CATEGORY_LABEL) {
    return `“${ALL_CATEGORY_LABEL}”는 기본 탭 이름으로 사용할 수 없습니다.`
  }

  const key = name.toLocaleLowerCase()
  if (
    categories.some(
      (category) =>
        category.id !== excludeId && category.name.toLocaleLowerCase() === key,
    )
  ) {
    return '이미 같은 이름의 카테고리가 있습니다.'
  }

  return null
}

export function getFallbackCategory(
  categories: Category[],
  excludeId?: string,
): Category | null {
  const candidates = excludeId
    ? categories.filter((category) => category.id !== excludeId)
    : categories
  return candidates.find((category) => category.id === DEFAULT_CATEGORY_ID) ?? candidates[0] ?? null
}

export function getFallbackCategoryId(categories: Category[], excludeId?: string): string {
  return getFallbackCategory(categories, excludeId)?.id ?? DEFAULT_CATEGORY_ID
}

export function getCategoryCounts(favorites: Favorite[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const favorite of favorites) {
    counts.set(favorite.categoryId, (counts.get(favorite.categoryId) ?? 0) + 1)
  }
  return counts
}

export function createCategory(name: string): Category {
  return { id: createId('category'), name: normalizeCategoryName(name) }
}

export function inferCategoryId(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLocaleLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }

  for (const rule of CATEGORY_HOST_RULES) {
    if (rule.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
      return rule.categoryId
    }
  }

  return null
}
