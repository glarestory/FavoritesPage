/**
 * Whether a favorite currently in `sourceCategoryId` may be dropped on the
 * category tab `targetId`. The "all" tab and the favorite's own category
 * are never drop targets.
 */
export function canDropFavoriteOnCategory(targetId, sourceCategoryId, allCategoryId) {
  if (sourceCategoryId === null) return false
  return targetId !== allCategoryId && targetId !== sourceCategoryId
}
