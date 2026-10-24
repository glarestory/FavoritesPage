import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { XIcon } from './Icons'

interface DialogProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  variant?: 'modal' | 'drawer'
  initialFocusSelector?: string
}

export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  variant = 'modal',
  initialFocusSelector,
}: DialogProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const subtitleId = useId()

  useDialogFocus(panelRef, initialFocusSelector)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className={`dialog-backdrop dialog-backdrop--${variant}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={panelRef}
        className={`dialog-panel dialog-panel--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <header className="dialog-header">
          <div className="dialog-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && (
              <p id={subtitleId} className="dialog-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button dialog-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <XIcon size={19} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  )
}
