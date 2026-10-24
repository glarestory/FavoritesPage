import { useEffect } from 'react'
import type { ToastMessage } from '../types'
import { AlertTriangleIcon, CheckIcon, XIcon } from './Icons'

interface ToastStackProps {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: number) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toast.tone === 'error' ? 6000 : 3500,
    )
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.tone, onDismiss])

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-icon" aria-hidden="true">
        {toast.tone === 'success' ? (
          <CheckIcon size={17} />
        ) : toast.tone === 'error' ? (
          <AlertTriangleIcon size={17} />
        ) : (
          <span className="toast-dot" />
        )}
      </span>
      <p>{toast.text}</p>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="알림 닫기"
      >
        <XIcon size={15} />
      </button>
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
