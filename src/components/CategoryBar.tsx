import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { Category, Favorite } from '../types'
import {
  ALL_CATEGORY_ID,
  ALL_CATEGORY_LABEL,
  getCategoryCounts,
} from '../lib/categories'
import { useCategoryDrop } from '../hooks/useCategoryDrop'
import { useVisibleTabCount } from '../hooks/useVisibleTabCount'
import { CategoryOverflowMenu } from './CategoryOverflowMenu'
import type { CategoryTabItem } from './CategoryOverflowMenu'
import { ChevronDownIcon, TagIcon } from './Icons'

interface CategoryBarProps {
  categories: Category[]
  favorites: Favorite[]
  activeCategoryId: string
  onSelectCategory: (categoryId: string) => void
  onManageCategories: () => void
  draggingCategoryId: string | null
  onDropFavorite: (categoryId: string) => void
}

export function CategoryBar({
  categories,
  favorites,
  activeCategoryId,
  onSelectCategory,
  onManageCategories,
  draggingCategoryId,
  onDropFavorite,
}: CategoryBarProps) {
  const { isDragging, getDropProps } = useCategoryDrop(draggingCategoryId, onDropFavorite)
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const counts = getCategoryCounts(favorites)
  const tabs: CategoryTabItem[] = [
    { id: ALL_CATEGORY_ID, name: ALL_CATEGORY_LABEL, count: favorites.length },
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) ?? 0,
    })),
  ]
  const activeTab = tabs.find((tab) => tab.id === activeCategoryId)
  const layoutKey = `${tabs.map((tab) => `${tab.name}:${tab.count}`).join('|')}#${activeTab?.id ?? ''}`
  const visibleCount = useVisibleTabCount(containerRef, measureRef, tabs.length, layoutKey)
  const visibleTabs = tabs.slice(0, visibleCount)
  const overflowTabs = tabs.slice(visibleCount)
  const hasActiveVisible = visibleTabs.some((tab) => tab.id === activeCategoryId)

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    const lastIndex = visibleTabs.length - 1
    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1
    else if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = lastIndex

    const nextTab = visibleTabs[nextIndex]
    if (!nextTab) return
    onSelectCategory(nextTab.id)
    window.requestAnimationFrame(() => {
      document.getElementById(`category-tab-${nextTab.id}`)?.focus()
    })
  }

  return (
    <div className="category-bar">
      <div ref={containerRef} className="category-tabs">
        <div className="category-tablist" role="tablist" aria-label="즐겨찾기 카테고리">
          {visibleTabs.map((tab, index) => {
            const isActive = activeCategoryId === tab.id
            const isFocusable = isActive || (!hasActiveVisible && index === 0)
            const { className: dropClassName = '', ...dropHandlers } =
              getDropProps(tab.id) ?? {}
            return (
              <button
                key={tab.id}
                id={`category-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="favorites-panel"
                tabIndex={isFocusable ? 0 : -1}
                className={`category-tab ${isActive ? 'is-active' : ''} ${dropClassName}`}
                onClick={() => onSelectCategory(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                {...dropHandlers}
              >
                <span>{tab.name}</span>
                <span className="category-count" aria-hidden="true">
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
        {overflowTabs.length > 0 && (
          <CategoryOverflowMenu
            items={overflowTabs}
            activeCategoryId={activeCategoryId}
            onSelectCategory={onSelectCategory}
            isDragging={isDragging}
            getDropProps={getDropProps}
          />
        )}
        <div ref={measureRef} className="category-tabs-measure" aria-hidden="true">
          {tabs.map((tab) => (
            <span key={tab.id} className="category-tab" data-measure="tab">
              <span>{tab.name}</span>
              <span className="category-count">{tab.count}</span>
            </span>
          ))}
          <span className="category-tab category-more-trigger" data-measure="more">
            <span>더보기</span>
            <ChevronDownIcon size={14} className="category-more-chevron" />
          </span>
          {activeTab && activeTab.id !== ALL_CATEGORY_ID && (
            <span className="category-tab category-more-trigger" data-measure="more">
              <span className="category-more-label">{activeTab.name}</span>
              <span className="category-count">{activeTab.count}</span>
              <ChevronDownIcon size={14} className="category-more-chevron" />
            </span>
          )}
        </div>
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
