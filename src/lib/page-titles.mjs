export const PAGE_TITLE_MAX_LENGTH = 40

/**
 * Cleans up a user-entered page title. Whitespace is collapsed, the result
 * is capped at PAGE_TITLE_MAX_LENGTH, and empty input yields `fallback`.
 */
export function normalizePageTitle(value, fallback) {
  if (typeof value !== 'string') return fallback
  const title = value.replace(/\s+/g, ' ').trim().slice(0, PAGE_TITLE_MAX_LENGTH).trim()
  return title || fallback
}
