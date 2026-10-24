import type { SearchEngineId } from '../types'

export interface SearchEngine {
  id: SearchEngineId
  name: string
  description: string
  template: string
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    description: '기본 검색 엔진',
    template: 'https://www.google.com/search?q=',
  },
  {
    id: 'bing',
    name: 'Bing',
    description: 'Microsoft 검색',
    template: 'https://www.bing.com/search?q=',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    description: '개인정보 보호 검색',
    template: 'https://duckduckgo.com/?q=',
  },
  {
    id: 'naver',
    name: 'Naver',
    description: '네이버 통합 검색',
    template: 'https://search.naver.com/search.naver?query=',
  },
]

export function getSearchEngine(id: SearchEngineId): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[0]!
}

export function buildSearchUrl(engineId: SearchEngineId, rawQuery: string): string | null {
  const query = rawQuery.trim()
  if (!query) return null
  return `${getSearchEngine(engineId).template}${encodeURIComponent(query)}`
}
