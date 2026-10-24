import { useEffect, useId, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Category, Favorite } from '../types'
import { getHostname, getSiteInitial } from '../lib/url'
import { FavoriteIcon } from './FavoriteIcon'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TagIcon,
  TrashIcon,
} from './Icons'

interface FavoriteCardProps {
  favorite: Favorite
  categories: Category[]
  menuOpen: boolean
  isDragging: boolean
  isDragOver: boolean
  isFiltering: boolean
  arranging: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onEdit: () => void
  onDelete: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onMoveToCategory: (categoryId: string) => void
  onDragStart: (event: ReactDragEvent<HTMLLIElement>) => void
  onDragOver: (event: ReactDragEvent<HTMLLIElement>) => void
  onDragLeave: (event: ReactDragEvent<HTMLLIElement>) => void
  onDrop: (event: ReactDragEvent<HTMLLIElement>) => void
  onDragEnd: () => void
  registerTrigger: (node: HTMLButtonElement | null) => void
  registerMenu: (node: HTMLDivElement | null) => void
}

export function FavoriteCard({
  favorite,
  categories,
  menuOpen,
  isDragging,
  isDragOver,
  isFiltering,
  arranging,
  canMoveLeft,
  canMoveRight,
  onMenuToggle,
  onMenuClose,
  onEdit,
  onDelete,
  onMoveLeft,
  onMoveRight,
  onMoveToCategory,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  registerTrigger,
  registerMenu,
}: FavoriteCardProps) {
  const menuId = useId()
  const hostname = getHostname(favorite.url)
  const initial = getSiteInitial(favorite.name)
  const reorderDisabled = isFiltering
  const [menuView, setMenuView] = useState<'main' | 'categories'>('main')
  const categoryTriggerRef = useRef<HTMLButtonElement>(null)
  const categoryBackRef = useRef<HTMLButtonElement>(null)
  const categoryListRef = useRef<HTMLDivElement>(null)

  const currentCategory = categories.find(
    (category) => category.id === favorite.categoryId,
  )

  useEffect(() => {
    if (!menuOpen) setMenuView('main')
  }, [menuOpen])

  useEffect(() => {
    if (menuView !== 'categories') return
    const frame = window.requestAnimationFrame(() => {
      const firstCategory =
        categoryListRef.current?.querySelector<HTMLButtonElement>(
          'button:not([disabled])',
        )
      ;(firstCategory ?? categoryBackRef.current)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [menuView])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    )
    if (items.length === 0) return
    event.preventDefault()

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex = 0

    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
    } else if (event.key === 'End') {
      nextIndex = items.length - 1
    }

    items[nextIndex]?.focus()
  }

  const handleBackToMain = () => {
    setMenuView('main')
    window.requestAnimationFrame(() => categoryTriggerRef.current?.focus())
  }

  return (
    <li
      className={[
        'favorite-card',
        menuOpen ? 'is-menu-open' : '',
        isDragging ? 'is-dragging' : '',
        isDragOver ? 'is-drag-over' : '',
        arranging ? 'is-arranging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-menu-root
      draggable={!isFiltering}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {arranging && (
        <span className="drag-grip" aria-hidden="true">
          <GripVerticalIcon size={14} />
        </span>
      )}
      <a
        className="favorite-link"
        href={favorite.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        aria-label={`${initial} ${favorite.name} 새 탭에서 열기`}
        title={`${favorite.name} — ${favorite.url}`}
        onClick={onMenuClose}
      >
        <FavoriteIcon favorite={favorite} />{' '}
        <span className="favorite-name">{favorite.name}</span>
      </a>
      <button
        ref={registerTrigger}
        type="button"
        className="favorite-menu-trigger"
        aria-label={`${favorite.name} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        title="편집 및 순서 메뉴"
        onClick={onMenuToggle}
      >
        <MoreHorizontalIcon size={17} />
      </button>
      {menuOpen && (
        <div
          ref={registerMenu}
          id={menuId}
          className="card-menu"
          role="menu"
          aria-label={`${favorite.name} 편집 메뉴`}
          onKeyDown={handleMenuKeyDown}
        >
          <p className="card-menu-title" title={hostname}>
            {favorite.name}
          </p>

          {menuView === 'main' ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="card-menu-item"
                onClick={onEdit}
              >
                <PencilIcon size={16} />
                수정
              </button>
              <button
                ref={categoryTriggerRef}
                type="button"
                role="menuitem"
                className="card-menu-item card-menu-item--category"
                aria-haspopup="menu"
                aria-expanded={false}
                onClick={() => setMenuView('categories')}
              >
                <TagIcon size={16} />
                <span className="card-menu-item-label">카테고리 이동</span>
                <span className="card-menu-current">
                  {currentCategory?.name ?? '기타'}
                </span>
                <ChevronRightIcon size={13} className="card-menu-chevron" />
              </button>
              <button
                type="button"
                role="menuitem"
                className="card-menu-item"
                onClick={onMoveLeft}
                disabled={!canMoveLeft || reorderDisabled}
                title={
                  reorderDisabled
                    ? '필터를 지우면 순서를 바꿀 수 있습니다.'
                    : undefined
                }
              >
                <ChevronLeftIcon size={16} />
                왼쪽으로 이동
              </button>
              <button
                type="button"
                role="menuitem"
                className="card-menu-item"
                onClick={onMoveRight}
                disabled={!canMoveRight || reorderDisabled}
                title={
                  reorderDisabled
                    ? '필터를 지우면 순서를 바꿀 수 있습니다.'
                    : undefined
                }
              >
                <ChevronRightIcon size={16} />
                오른쪽으로 이동
              </button>
              <div className="card-menu-divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="card-menu-item card-menu-item--danger"
                onClick={onDelete}
              >
                <TrashIcon size={16} />
                삭제
              </button>
            </>
          ) : (
            <>
              <div className="card-menu-subhead">
                <button
                  ref={categoryBackRef}
                  type="button"
                  className="card-menu-back"
                  onClick={handleBackToMain}
                >
                  <ChevronLeftIcon size={15} />
                  <span>카테고리 이동</span>
                </button>
              </div>
              <div ref={categoryListRef} className="card-menu-category-list">
                {categories.map((category) => {
                  const isCurrent = category.id === favorite.categoryId
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="menuitem"
                      className={`card-menu-item ${isCurrent ? 'is-current' : ''}`}
                      disabled={isCurrent}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => {
                        if (!isCurrent) onMoveToCategory(category.id)
                      }}
                    >
                      <TagIcon size={16} />
                      <span className="card-menu-item-label">{category.name}</span>
                      {isCurrent && (
                        <CheckIcon size={14} className="card-menu-check" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}
