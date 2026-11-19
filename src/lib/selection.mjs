// 즐겨찾기 다중 선택, 일괄 삭제, 카테고리 일괄 이동을 처리하는 순수 로직 모듈입니다.

/**
 * 선택 목록에 특정 즐겨찾기 ID를 토글합니다.
 */
export function toggleSelectionId(selectedIds, id) {
  if (!id) return [...selectedIds]
  if (selectedIds.includes(id)) {
    return selectedIds.filter((item) => item !== id)
  }
  return [...selectedIds, id]
}

/**
 * 현재 화면에 표시된 항목들의 선택 상태를 계산합니다.
 */
export function getVisibleSelectionState(selectedIds, visibleIds) {
  const selectedSet = new Set(selectedIds)
  let visibleSelectedCount = 0
  for (const id of visibleIds) {
    if (selectedSet.has(id)) visibleSelectedCount += 1
  }
  const totalVisible = visibleIds.length
  return {
    visibleSelectedCount,
    allVisibleSelected: totalVisible > 0 && visibleSelectedCount === totalVisible,
    someVisibleSelected: visibleSelectedCount > 0 && visibleSelectedCount < totalVisible,
  }
}

/**
 * 현재 화면에 표시된 항목들을 한꺼번에 선택하거나 모두 해제합니다.
 * 다른 탭에서 이미 선택해 둔 항목은 유지합니다.
 */
export function toggleSelectAllVisible(selectedIds, visibleIds) {
  if (visibleIds.length === 0) return [...selectedIds]
  const visibleSet = new Set(visibleIds)
  const { allVisibleSelected } = getVisibleSelectionState(selectedIds, visibleIds)

  if (allVisibleSelected) {
    return selectedIds.filter((id) => !visibleSet.has(id))
  }

  const next = [...selectedIds]
  const existing = new Set(selectedIds)
  for (const id of visibleIds) {
    if (!existing.has(id)) {
      existing.add(id)
      next.push(id)
    }
  }
  return next
}

/**
 * 현재 존재하는 즐겨찾기 목록 기준으로 유효한 선택 ID만 남깁니다.
 */
export function pruneSelectionIds(selectedIds, favorites) {
  const validIds = new Set(favorites.map((favorite) => favorite.id))
  return selectedIds.filter((id) => validIds.has(id))
}

/**
 * 선택한 ID 목록에 해당하는 즐겨찾기를 일괄 삭제합니다.
 */
export function removeFavoritesByIds(favorites, idsToRemove) {
  const removeSet = new Set(idsToRemove)
  if (removeSet.size === 0) {
    return { favorites: [...favorites], removedCount: 0 }
  }
  const next = favorites.filter((favorite) => !removeSet.has(favorite.id))
  return {
    favorites: next,
    removedCount: favorites.length - next.length,
  }
}

/**
 * 선택한 즐겨찾기 항목들을 지정한 카테고리로 일괄 이동합니다.
 */
export function moveFavoritesToCategory(favorites, idsToMove, targetCategoryId) {
  const moveSet = new Set(idsToMove)
  if (moveSet.size === 0 || !targetCategoryId) {
    return { favorites: [...favorites], movedCount: 0 }
  }

  let movedCount = 0
  const next = favorites.map((favorite) => {
    if (!moveSet.has(favorite.id) || favorite.categoryId === targetCategoryId) {
      return favorite
    }
    movedCount += 1
    return { ...favorite, categoryId: targetCategoryId }
  })

  return { favorites: next, movedCount }
}
