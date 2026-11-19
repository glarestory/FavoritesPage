import { useState } from 'react'
import { MAX_MEMO_LENGTH } from '../../lib/widgets.mjs'
import { CheckIcon, CopyIcon, FileTextIcon, TrashIcon } from '../Icons'

interface QuickMemoWidgetProps {
  memo: string
  onChangeMemo: (value: string) => void
}

export function QuickMemoWidget({ memo, onChangeMemo }: QuickMemoWidgetProps) {
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const handleCopy = async () => {
    if (!memo.trim()) return
    try {
      await navigator.clipboard.writeText(memo)
      setCopied(true)
      setStatusMessage('메모를 클립보드에 복사했습니다.')
      window.setTimeout(() => {
        setCopied(false)
        setStatusMessage('')
      }, 1800)
    } catch {
      setStatusMessage('클립보드 복사에 실패했습니다.')
    }
  }

  const handleClear = () => {
    onChangeMemo('')
    setConfirmClear(false)
    setStatusMessage('메모를 비웠습니다.')
    window.setTimeout(() => setStatusMessage(''), 1800)
  }

  return (
    <section className="widget-card" aria-labelledby="widget-memo-title">
      <div className="widget-head">
        <h2 id="widget-memo-title" className="widget-title">
          <FileTextIcon size={15} />
          <span>빠른 메모</span>
        </h2>
        <div className="widget-head-actions">
          <button
            type="button"
            className="widget-icon-button"
            onClick={() => void handleCopy()}
            disabled={!memo.trim()}
            aria-label="메모 복사"
            title="클립보드에 복사"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </button>
          {confirmClear ? (
            <div className="widget-inline-confirm">
              <button
                type="button"
                className="widget-chip-button is-danger"
                onClick={handleClear}
              >
                비우기
              </button>
              <button
                type="button"
                className="widget-chip-button"
                onClick={() => setConfirmClear(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="widget-icon-button"
              onClick={() => setConfirmClear(true)}
              disabled={!memo}
              aria-label="메모 비우기"
              title="메모 비우기"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <label className="sr-only" htmlFor="quick-memo-textarea">
        빠른 메모 입력
      </label>
      <textarea
        id="quick-memo-textarea"
        className="quick-memo-textarea"
        value={memo}
        maxLength={MAX_MEMO_LENGTH}
        rows={6}
        placeholder="잠깐 적어둘 할 일, 명령어, 아이디어를 입력하세요. 자동으로 저장됩니다."
        onChange={(event) => {
          onChangeMemo(event.target.value)
          if (confirmClear) setConfirmClear(false)
        }}
      />

      <div className="memo-footer">
        <span className="memo-status" role="status" aria-live="polite">
          {statusMessage || (memo ? '자동 저장됨' : '')}
        </span>
        <span className="memo-length">
          {memo.length.toLocaleString()} / {MAX_MEMO_LENGTH.toLocaleString()}
        </span>
      </div>
    </section>
  )
}
