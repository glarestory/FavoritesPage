import type { Favorite } from '../types'

export interface VisibleSelectionState {
  visibleSelectedCount: number
  allVisibleSelected: boolean
  someVisibleSelected: boolean
}

export declare function toggleSelectionId(selectedIds: string[], id: string): string[]
export declare function getVisibleSelectionState(
  selectedIds: string[],
  visibleIds: string[],
): VisibleSelectionState
export declare function toggleSelectAllVisible(
  selectedIds: string[],
  visibleIds: string[],
): string[]
export declare function pruneSelectionIds(
  selectedIds: string[],
  favorites: Pick<Favorite, 'id'>[],
): string[]
export declare function removeFavoritesByIds(
  favorites: Favorite[],
  idsToRemove: string[],
): { favorites: Favorite[]; removedCount: number }
export declare function moveFavoritesToCategory(
  favorites: Favorite[],
  idsToMove: string[],
  targetCategoryId: string,
): { favorites: Favorite[]; movedCount: number }
