import { useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { Category, Favorite } from '../types'
import { ALL_CATEGORY_ID, ALL_CATEGORY_LABEL } from '../lib/categories'
import { CategoryBar } from './CategoryBar'
import { FavoriteCard } from './FavoriteCard'
import { GripVerticalIcon, PlusIcon, SearchIcon, XIcon } from './Icons'

interface FavoritesGridProps {
  allFavorites: Favorite[]
  visibleFavorites: Favorite[]
  filteredFavorites: Favorite[]
  categories: Category[]
  activeCategoryId: string
  filter: string
  onFilterChange: (value: string) => void
  onSelectCategory: (categoryId: string) => void
  onManageCategories: () => void
  onOpenAdd: () => void
  onEditFavorite: (favorite: Favorite) => void
  onDeleteFavorite: (favorite: Favorite) => void
  onReorder: (sourceId: string, targetId: string) => void
  onMoveFavorite: (favoriteId: string, direction: -1 | 1) => void
  onMoveToCategory: (favoriteId: string, categoryId: string) => void
  onRestoreDefaults: () => void
  arranging: boolean
  onExitArrange: () => void
}

export function FavoritesGrid({
  allFavorites,
  visibleFavorites,
  filteredFavorites,
  categories,
  activeCategoryId,
  filter,
  onFilterChange,
  onSelectCategory,
  onManageCategories,
  onOpenAdd,
  onEditFavorite,
  onDeleteFavorite,
  onReorder,
  onMoveFavorite,
  onMoveToCategory,
  onRestoreDefaults,
  arranging,
  onExitArrange,
}: FavoritesGridProps) {
  const isFiltering = filter.trim().length > 0
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const menuRefs = useRef(new Map<string, HTMLDivElement>())

  const activeCategoryName =
    activeCategoryId === ALL_CATEGORY_ID
      ? ALL_CATEGORY_LABEL
      : categories.find((category) => category.id === activeCategoryId)?.name ??
        ALL_CATEGORY_LABEL

  useEffect(() => {
    if (!menuOpenId) return

    const focusFrame = window.requestAnimationFrame(() => {
      const menu = menuRefs.current.get(menuOpenId)
      menu?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    })

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-menu-root]')) return
      setMenuOpenId(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const id = menuOpenId
      setMenuOpenId(null)
      triggerRefs.current.get(id)?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpenId])

  useEffect(() => {
    if (isFiltering) setMenuOpenId(null)
  }, [isFiltering])

  useEffect(() => {
    setMenuOpenId(null)
  }, [activeCategoryId])

  const handleDragStart = (event: ReactDragEvent<HTMLLIElement>, id: string) => {
    if (isFiltering) {
      event.preventDefault()
      return
    }
    setMenuOpenId(null)
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (event: ReactDragEvent<HTMLLIElement>, id: string) => {
    if (!draggedId || isFiltering) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverId !== id) setDragOverId(id)
  }

  const handleDragLeave = (event: ReactDragEvent<HTMLLIElement>, id: string) => {
    const related = event.relatedTarget
    if (related instanceof Node && event.currentTarget.contains(related)) return
    setDragOverId((current) => (current === id ? null : current))
  }

  const handleDrop = (event: ReactDragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault()
    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== id) onReorder(sourceId, id)
    setDraggedId(null)
    setDragOverId(null)
  }

  const closeMenu = () => setMenuOpenId(null)

  const focusTrigger = (favoriteId: string) => {
    triggerRefs.current.get(favoriteId)?.focus()
  }

  const handleEdit = (favorite: Favorite) => {
    focusTrigger(favorite.id)
    setMenuOpenId(null)
    onEditFavorite(favorite)
  }

  const handleDelete = (favorite: Favorite) => {
    focusTrigger(favorite.id)
    setMenuOpenId(null)
    onDeleteFavorite(favorite)
  }

  const handleMove = (favorite: Favorite, direction: -1 | 1) => {
    focusTrigger(favorite.id)
    setMenuOpenId(null)
    onMoveFavorite(favorite.id, direction)
  }

  const handleMoveToCategory = (favorite: Favorite, categoryId: string) => {
    setMenuOpenId(null)
    if (
      activeCategoryId !== ALL_CATEGORY_ID &&
      categoryId !== activeCategoryId
    ) {
      window.requestAnimationFrame(() => {
        document.getElementById(`category-tab-${activeCategoryId}`)?.focus()
      })
    } else {
      focusTrigger(favorite.id)
    }
    onMoveToCategory(favorite.id, categoryId)
  }

  const countLabel =
    allFavorites.length === 0
      ? '즐겨찾기가 없습니다'
      : isFiltering
        ? `필터 결과 ${filteredFavorites.length}개 / ${
            activeCategoryId === ALL_CATEGORY_ID
              ? `전체 ${allFavorites.length}개`
              : `${activeCategoryName} ${visibleFavorites.length}개`
          }`
        : activeCategoryId === ALL_CATEGORY_ID
          ? `즐겨찾기 ${allFavorites.length}개`
          : `${activeCategoryName} ${visibleFavorites.length}개`

  return (
    <section className="favorites-section" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" className="sr-only">
        즐겨찾기
      </h2>

      <CategoryBar
        categories={categories}
        favorites={allFavorites}
        activeCategoryId={activeCategoryId}
        onSelectCategory={onSelectCategory}
        onManageCategories={onManageCategories}
      />

      <div
        id="favorites-panel"
        role="tabpanel"
        aria-labelledby={`category-tab-${activeCategoryId}`}
      >
        <div className="grid-toolbar">
          <p className="grid-count" aria-live="polite">
            {countLabel}
          </p>
          <div className="filter-field">
            <SearchIcon size={16} className="filter-icon" />
            <label className="sr-only" htmlFor="favorite-filter">
              즐겨찾기 이름 또는 URL 필터
            </label>
            <input
              id="favorite-filter"
              type="search"
              value={filter}
              placeholder="즐겨찾기 필터"
              autoComplete="off"
              onChange={(event) => onFilterChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && filter) {
                  event.preventDefault()
                  onFilterChange('')
                }
              }}
            />
            {filter && (
              <button
                type="button"
                className="filter-clear"
                onClick={() => onFilterChange('')}
                aria-label="즐겨찾기 필터 지우기"
              >
                <XIcon size={15} />
              </button>
            )}
          </div>
        </div>

        {arranging && (
          <div className="arrange-banner" role="status">
            <GripVerticalIcon size={17} />
            <p>
              {isFiltering
                ? '필터를 지우면 카드 순서를 바꿀 수 있습니다.'
                : activeCategoryId === ALL_CATEGORY_ID
                  ? '아이콘을 드래그하거나 카드의 ⋯ 메뉴에서 이동해 순서를 바꾸세요.'
                  : '현재 카테고리 안에서 아이콘을 드래그하거나 카드의 ⋯ 메뉴로 순서를 바꾸세요.'}
            </p>
            <button type="button" className="text-button" onClick={onExitArrange}>
              완료
            </button>
          </div>
        )}

        <p id="grid-instructions" className="sr-only">
          각 사이트는 Enter 키로 열 수 있습니다. 카드의 메뉴 버튼에서 수정, 삭제,
          카테고리 이동, 순서 이동을 실행할 수 있습니다. 상단 카테고리 탭으로 표시할
          사이트를 선택할 수 있습니다. 데스크톱에서는 카드를 드래그해 순서를 바꿀 수
          있습니다.
        </p>

        {isFiltering && filteredFavorites.length === 0 ? (
          <div className="empty-state" role="status">
            <span className="empty-state-icon" aria-hidden="true">
              <SearchIcon size={26} />
            </span>
            <p className="empty-state-title">일치하는 즐겨찾기가 없습니다.</p>
            <p className="empty-state-description">
              다른 이름이나 URL로 검색해 보세요.
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onFilterChange('')}
            >
              필터 지우기
            </button>
          </div>
        ) : (
          <>
            {visibleFavorites.length === 0 && (
              <div className="empty-hint">
                {allFavorites.length === 0 ? (
                  <>
                    <p>
                      아직 즐겨찾기가 없습니다. 아래 + 버튼으로 첫 사이트를 추가해
                      보세요.
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={onRestoreDefaults}
                    >
                      기본 즐겨찾기 불러오기
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      이 카테고리에 즐겨찾기가 없습니다. 아래 + 버튼으로 추가하거나 다른
                      카테고리의 사이트를 이동해 보세요.
                    </p>
                    {activeCategoryId !== ALL_CATEGORY_ID && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onSelectCategory(ALL_CATEGORY_ID)}
                      >
                        전체 즐겨찾기 보기
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <ul
              className="favorites-grid"
              aria-label={
                activeCategoryId === ALL_CATEGORY_ID
                  ? '즐겨찾기 목록'
                  : `${activeCategoryName} 카테고리 즐겨찾기 목록`
              }
              aria-describedby="grid-instructions"
            >
              {filteredFavorites.map((favorite) => {
                const visibleIndex = visibleFavorites.findIndex(
                  (item) => item.id === favorite.id,
                )
                return (
                  <FavoriteCard
                    key={favorite.id}
                    favorite={favorite}
                    categories={categories}
                    menuOpen={menuOpenId === favorite.id}
                    isDragging={draggedId === favorite.id}
                    isDragOver={dragOverId === favorite.id && draggedId !== favorite.id}
                    isFiltering={isFiltering}
                    arranging={arranging}
                    canMoveLeft={visibleIndex > 0}
                    canMoveRight={
                      visibleIndex >= 0 && visibleIndex < visibleFavorites.length - 1
                    }
                    onMenuToggle={() =>
                      setMenuOpenId((current) =>
                        current === favorite.id ? null : favorite.id,
                      )
                    }
                    onMenuClose={closeMenu}
                    onEdit={() => handleEdit(favorite)}
                    onDelete={() => handleDelete(favorite)}
                    onMoveLeft={() => handleMove(favorite, -1)}
                    onMoveRight={() => handleMove(favorite, 1)}
                    onMoveToCategory={(categoryId) =>
                      handleMoveToCategory(favorite, categoryId)
                    }
                    onDragStart={(event) => handleDragStart(event, favorite.id)}
                    onDragOver={(event) => handleDragOver(event, favorite.id)}
                    onDragLeave={(event) => handleDragLeave(event, favorite.id)}
                    onDrop={(event) => handleDrop(event, favorite.id)}
                    onDragEnd={() => {
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                    registerTrigger={(node) => {
                      if (node) triggerRefs.current.set(favorite.id, node)
                      else triggerRefs.current.delete(favorite.id)
                    }}
                    registerMenu={(node) => {
                      if (node) menuRefs.current.set(favorite.id, node)
                      else menuRefs.current.delete(favorite.id)
                    }}
                  />
                )
              })}
              {!isFiltering && (
                <li className="favorite-card add-card-item">
                  <button type="button" className="add-card" onClick={onOpenAdd}>
                    <span className="add-card-icon" aria-hidden="true">
                      <PlusIcon size={24} />
                    </span>
                    <span className="favorite-name">바로가기 추가</span>
                  </button>
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
