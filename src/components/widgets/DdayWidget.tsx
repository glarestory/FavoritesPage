import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { DdayItem } from '../../types'
import {
  calculateDdayDiff,
  getTodayDateKey,
  MAX_DDAYS,
  MAX_DDAY_TITLE_LENGTH,
  parseDateKey,
  sortDdays,
} from '../../lib/widgets.mjs'
import { FlagIcon, PlusIcon, XIcon } from '../Icons'

interface DdayWidgetProps {
  ddays: DdayItem[]
  onAddDday: (title: string, targetDate: string) => void
  onDeleteDday: (id: string) => void
}

export function DdayWidget({ ddays, onAddDday, onDeleteDday }: DdayWidgetProps) {
  const todayKey = getTodayDateKey()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState(todayKey)
  const [error, setError] = useState('')

  const sortedDdays = useMemo(() => sortDdays(ddays, todayKey), [ddays, todayKey])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('일정 이름을 입력해 주세요.')
      return
    }
    if (!parseDateKey(targetDate)) {
      setError('올바른 날짜를 선택해 주세요.')
      return
    }
    if (ddays.length >= MAX_DDAYS) {
      setError(`D-Day는 최대 ${MAX_DDAYS}개까지 등록할 수 있습니다.`)
      return
    }

    onAddDday(trimmed, targetDate)
    setTitle('')
    setTargetDate(todayKey)
    setError('')
    setAdding(false)
  }

  return (
    <section className="widget-card" aria-labelledby="widget-dday-title">
      <div className="widget-head">
        <h2 id="widget-dday-title" className="widget-title">
          <FlagIcon size={15} />
          <span>D-Day</span>
          {ddays.length > 0 && <span className="widget-count">{ddays.length}</span>}
        </h2>
        <button
          type="button"
          className="widget-icon-button"
          onClick={() => {
            setAdding((current) => !current)
            setError('')
          }}
          disabled={!adding && ddays.length >= MAX_DDAYS}
          aria-expanded={adding}
          aria-label={adding ? 'D-Day 추가 닫기' : 'D-Day 추가'}
          title={adding ? '닫기' : 'D-Day 추가'}
        >
          {adding ? <XIcon size={15} /> : <PlusIcon size={15} />}
        </button>
      </div>

      {adding && (
        <form className="dday-form" onSubmit={handleSubmit} noValidate>
          <label className="sr-only" htmlFor="dday-title-input">
            D-Day 일정 이름
          </label>
          <input
            id="dday-title-input"
            type="text"
            value={title}
            maxLength={MAX_DDAY_TITLE_LENGTH}
            placeholder="일정 이름 (예: 프로젝트 마감)"
            autoFocus
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError('')
            }}
          />
          <div className="dday-form-row">
            <label className="sr-only" htmlFor="dday-date-input">
              목표 날짜
            </label>
            <input
              id="dday-date-input"
              type="date"
              value={targetDate}
              onChange={(event) => {
                setTargetDate(event.target.value)
                if (error) setError('')
              }}
            />
            <button type="submit" className="widget-chip-button is-primary">
              추가
            </button>
          </div>
          {error && (
            <p className="widget-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {sortedDdays.length === 0 ? (
        <p className="widget-empty">
          중요한 마감일이나 일정을 추가해 카운트다운하세요.
        </p>
      ) : (
        <ul className="dday-list" aria-label="D-Day 목록">
          {sortedDdays.map((item) => {
            const diff = calculateDdayDiff(item.targetDate, todayKey)
            return (
              <li key={item.id} className="dday-item">
                <div className="dday-copy">
                  <span className="dday-item-title" title={item.title}>
                    {item.title}
                  </span>
                  <span className="dday-item-date">{item.targetDate}</span>
                </div>
                {diff && (
                  <span className={`dday-badge is-${diff.status}`}>{diff.label}</span>
                )}
                <button
                  type="button"
                  className="dday-delete"
                  onClick={() => onDeleteDday(item.id)}
                  aria-label={`${item.title} D-Day 삭제`}
                  title="삭제"
                >
                  <XIcon size={13} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
