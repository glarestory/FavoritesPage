import { useEffect, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import { ALL_CATEGORY_ID } from '../lib/categories'
import { canDropFavoriteOnCategory } from '../lib/category-drop.mjs'

export interface CategoryDropProps {
  className: string
  onDragOver: (event: ReactDragEvent<HTMLElement>) => void
  onDragLeave: (event: ReactDragEvent<HTMLElement>) => void
  onDrop: (event: ReactDragEvent<HTMLElement>) => void
}

/**
 * Lets category tabs accept a favorite card being dragged from the grid.
 * `sourceCategoryId` is the dragged favorite's category, or null when idle.
 */
export function useCategoryDrop(
  sourceCategoryId: string | null,
  onDropFavorite: (categoryId: string) => void,
) {
  const [dropOverId, setDropOverId] = useState<string | null>(null)

  useEffect(() => {
    if (sourceCategoryId === null) setDropOverId(null)
  }, [sourceCategoryId])

  const getDropProps = (id: string): CategoryDropProps | undefined => {
    if (!canDropFavoriteOnCategory(id, sourceCategoryId, ALL_CATEGORY_ID)) return undefined
    return {
      className: dropOverId === id ? 'is-drop-target is-drop-over' : 'is-drop-target',
      onDragOver: (event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (dropOverId !== id) setDropOverId(id)
      },
      onDragLeave: (event) => {
        const related = event.relatedTarget
        if (related instanceof Node && event.currentTarget.contains(related)) return
        setDropOverId((current) => (current === id ? null : current))
      },
      onDrop: (event) => {
        event.preventDefault()
        setDropOverId(null)
        onDropFavorite(id)
      },
    }
  }

  return { isDragging: sourceCategoryId !== null, getDropProps }
}
