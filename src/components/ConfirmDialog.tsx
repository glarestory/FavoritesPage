import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { AlertTriangleIcon } from './Icons'

interface ConfirmDialogProps {
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      initialFocusSelector="[data-autofocus]"
      footer={
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={onCancel}
            data-autofocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-content">
        <span className={`confirm-icon confirm-icon--${tone}`} aria-hidden="true">
          <AlertTriangleIcon size={24} />
        </span>
        <div className="confirm-text">{description}</div>
      </div>
    </Dialog>
  )
}
