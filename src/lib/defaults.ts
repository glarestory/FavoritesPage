import type { Favorite, Settings } from '../types'
import { DEFAULT_CATEGORY_ID } from './categories'

export const STORAGE_KEYS = {
  favorites: 'my-start-page.favorites.v1',
  categories: 'my-start-page.categories.v1',
  settings: 'my-start-page.settings.v1',
} as const

const STARTER_FAVORITES: ReadonlyArray<Omit<Favorite, 'id' | 'createdAt'>> = [
  { name: 'Google', url: 'https://www.google.com/', categoryId: DEFAULT_CATEGORY_ID },
  { name: 'YouTube', url: 'https://www.youtube.com/', categoryId: DEFAULT_CATEGORY_ID },
  { name: 'GitHub', url: 'https://github.com/', categoryId: 'dev' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/', categoryId: 'ai' },
  { name: 'Claude', url: 'https://claude.ai/', categoryId: 'ai' },
  { name: 'Naver', url: 'https://www.naver.com/', categoryId: 'news' },
  { name: 'Gmail', url: 'https://mail.google.com/', categoryId: 'work' },
  { name: 'Google Drive', url: 'https://drive.google.com/', categoryId: 'work' },
]

export const DEFAULT_FAVORITES: Favorite[] = STARTER_FAVORITES.map((site, index) => ({
  ...site,
  id: `starter-${index + 1}`,
  createdAt: 1_700_000_000_000 + index,
}))

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  searchEngine: 'google',
  background: { type: 'default' },
  openInNewTab: false,
  siteTitle: 'My Start Page',
  heroTitle: 'My Homepage',
}

export function createStarterFavorites(): Favorite[] {
  return DEFAULT_FAVORITES.map((favorite) => ({ ...favorite }))
}

export function createDefaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS, background: { ...DEFAULT_SETTINGS.background } }
}
