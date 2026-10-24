import type { KeyboardEvent } from 'react'
import type { Category, Favorite } from '../types'
import {
  ALL_CATEGORY_ID,
  ALL_CATEGORY_LABEL,
  getCategoryCounts,
} from '../lib/categories'
import { TagIcon } from './Icons'

interface CategoryBarProps {
  categories: Category[]
  favorites: Favorite[]
  activeCategoryId: string
  onSelectCategory: (categoryId: string) => void
  onManageCategories: () => void
}

export function CategoryBar({
  categories,
  favorites,
  activeCategoryId,
  onSelectCategory,
  onManageCategories,
}: CategoryBarProps) {
  const counts = getCategoryCounts(favorites)
  const tabs = [
    { id: ALL_CATEGORY_ID, name: ALL_CATEGORY_LABEL, count: favorites.length },
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) ?? 0,
    })),
  ]

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1

    const nextTab = tabs[nextIndex]
    if (!nextTab) return
    onSelectCategory(nextTab.id)
    window.requestAnimationFrame(() => {
      document.getElementById(`category-tab-${nextTab.id}`)?.focus()
    })
  }

  return (
    <div className="category-bar">
      <div className="category-tabs" role="tablist" aria-label="즐겨찾기 카테고리">
        {tabs.map((tab, index) => {
          const isActive = activeCategoryId === tab.id
          return (
            <button
              key={tab.id}
              id={`category-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="favorites-panel"
              tabIndex={isActive ? 0 : -1}
              className={`category-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelectCategory(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{tab.name}</span>
              <span className="category-count" aria-hidden="true">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="category-manage-button"
        onClick={onManageCategories}
        aria-label="카테고리 관리"
        title="카테고리 추가·수정·삭제"
      >
        <TagIcon size={16} />
        <span>관리</span>
      </button>
    </div>
  )
}
