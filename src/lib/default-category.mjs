/**
 * The category tab selected by default: the first category, or the "all"
 * tab when no categories exist.
 */
export function getDefaultCategoryId(categories, allCategoryId) {
  return categories[0]?.id ?? allCategoryId
}
