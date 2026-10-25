import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CheckIcon, ChevronDownIcon } from './Icons'

export interface CategoryTabItem {
  id: string
  name: string
  count: number
}

interface CategoryOverflowMenuProps {
  items: CategoryTabItem[]
  activeCategoryId: string
  onSelectCategory: (categoryId: string) => void
}

export function CategoryOverflowMenu({
  items,
  activeCategoryId,
  onSelectCategory,
}: CategoryOverflowMenuProps) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeItem = items.find((item) => item.id === activeCategoryId)

  useEffect(() => {
    if (!open) return

    const focusFrame = window.requestAnimationFrame(() => {
      const menu = menuRef.current
      const target =
        menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
        menu?.querySelector<HTMLButtonElement>('button')
      target?.focus()
    })

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    if (buttons.length === 0) return
    event.preventDefault()

    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex = 0

    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1
    } else if (event.key === 'End') {
      nextIndex = buttons.length - 1
    }

    buttons[nextIndex]?.focus()
  }

  const handleSelect = (categoryId: string) => {
    onSelectCategory(categoryId)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="category-more">
      <button
        ref={triggerRef}
        type="button"
        className={`category-tab category-more-trigger ${activeItem ? 'is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={
          activeItem
            ? `카테고리 더보기 (현재: ${activeItem.name})`
            : `카테고리 더보기 (${items.length}개)`
        }
        title="나머지 카테고리"
        onClick={() => setOpen((value) => !value)}
      >
        {activeItem ? (
          <>
            <span className="category-more-label">{activeItem.name}</span>
            <span className="category-count" aria-hidden="true">
              {activeItem.count}
            </span>
          </>
        ) : (
          <span>더보기</span>
        )}
        <ChevronDownIcon size={14} className="category-more-chevron" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="category-more-menu"
          role="menu"
          aria-label="나머지 카테고리"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => {
            const isActive = item.id === activeCategoryId
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`card-menu-item ${isActive ? 'is-current' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                <span className="card-menu-item-label">{item.name}</span>
                <span className="category-count" aria-hidden="true">
                  {item.count}
                </span>
                {isActive && <CheckIcon size={14} className="card-menu-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
