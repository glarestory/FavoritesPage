export type SearchEngineId = 'google' | 'bing' | 'duckduckgo' | 'naver'

export type ThemeMode = 'light' | 'dark'

export type GradientId = 'daylight' | 'mist' | 'mint' | 'lavender' | 'midnight' | 'graphite'

export type BackgroundSettings =
  | { type: 'default' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; gradient: GradientId }
  | { type: 'image'; url: string; overlay: number }

export interface Category {
  id: string
  name: string
}

export interface Favorite {
  id: string
  name: string
  url: string
  iconUrl?: string
  categoryId: string
  createdAt: number
}

export interface FavoriteInput {
  name: string
  url: string
  iconUrl?: string
  categoryId: string
}

export interface Settings {
  theme: ThemeMode
  searchEngine: SearchEngineId
  background: BackgroundSettings
  openInNewTab: boolean
}

export interface BackupFile {
  app: 'my-start-page'
  version: 2
  exportedAt: string
  favorites: Favorite[]
  categories: Category[]
  settings: Settings
}

export type SettingsTab = 'general' | 'background' | 'data'

export interface ToastMessage {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
}
