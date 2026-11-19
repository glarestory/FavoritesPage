import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { CalendarNoteMap, DdayItem } from '../../types'
import {
  getCalendarGrid,
  getTodayDateKey,
  MAX_CALENDAR_NOTE_LENGTH,
  parseDateKey,
} from '../../lib/widgets.mjs'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '../Icons'

interface MiniCalendarWidgetProps {
  notes: CalendarNoteMap
  ddays: DdayItem[]
  onSaveNote: (dateKey: string, note: string) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function MiniCalendarWidget({
  notes,
  ddays,
  onSaveNote,
}: MiniCalendarWidgetProps) {
  const todayKey = getTodayDateKey()
  const todayParts = parseDateKey(todayKey) ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  }

  const [viewYear, setViewYear] = useState(todayParts.year)
  const [viewMonth, setViewMonth] = useState(todayParts.month)
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [noteInput, setNoteInput] = useState(notes[todayKey] ?? '')

  useEffect(() => {
    setNoteInput(notes[selectedDateKey] ?? '')
  }, [selectedDateKey, notes])

  const cells = useMemo(
    () => getCalendarGrid(viewYear, viewMonth, todayKey),
    [viewYear, viewMonth, todayKey],
  )

  const ddayDateSet = useMemo(
    () => new Set(ddays.map((item) => item.targetDate)),
    [ddays],
  )

  const selectedDdays = useMemo(
    () => ddays.filter((item) => item.targetDate === selectedDateKey),
    [ddays, selectedDateKey],
  )

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth() + 1)
  }

  const goToToday = () => {
    setViewYear(todayParts.year)
    setViewMonth(todayParts.month)
    setSelectedDateKey(todayKey)
  }

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey)
    const parsed = parseDateKey(dateKey)
    if (parsed && (parsed.year !== viewYear || parsed.month !== viewMonth)) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
  }

  const handleNoteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSaveNote(selectedDateKey, noteInput)
  }

  const isViewingCurrentMonth =
    viewYear === todayParts.year && viewMonth === todayParts.month

  const savedNote = notes[selectedDateKey] ?? ''
  const isDirty = noteInput.trim() !== savedNote

  const selectedLabel = (() => {
    const parsed = parseDateKey(selectedDateKey)
    if (!parsed) return selectedDateKey
    return `${parsed.month}월 ${parsed.day}일`
  })()

  return (
    <section className="widget-card" aria-labelledby="widget-calendar-title">
      <div className="widget-head">
        <h2 id="widget-calendar-title" className="widget-title">
          <CalendarIcon size={15} />
          <span>
            {viewYear}년 {viewMonth}월
          </span>
        </h2>
        <div className="widget-head-actions">
          {!isViewingCurrentMonth && (
            <button
              type="button"
              className="widget-chip-button"
              onClick={goToToday}
            >
              오늘
            </button>
          )}
          <button
            type="button"
            className="widget-icon-button"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
            title="이전 달"
          >
            <ChevronLeftIcon size={15} />
          </button>
          <button
            type="button"
            className="widget-icon-button"
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
            title="다음 달"
          >
            <ChevronRightIcon size={15} />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day, index) => (
          <span
            key={day}
            className={index === 0 ? 'is-sun' : index === 6 ? 'is-sat' : undefined}
          >
            {day}
          </span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={`${viewYear}년 ${viewMonth}월 달력`}>
        {cells.map((cell) => {
          const hasNote = Boolean(notes[cell.dateKey])
          const hasDday = ddayDateSet.has(cell.dateKey)
          const isSelected = cell.dateKey === selectedDateKey
          return (
            <button
              key={cell.dateKey}
              type="button"
              className={[
                'calendar-day',
                cell.inCurrentMonth ? '' : 'is-outside',
                cell.isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                cell.weekday === 0 ? 'is-sun' : '',
                cell.weekday === 6 ? 'is-sat' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isSelected}
              aria-label={`${cell.dateKey}${cell.isToday ? ' 오늘' : ''}${
                hasNote ? ' 메모 있음' : ''
              }${hasDday ? ' D-Day 일정 있음' : ''}`}
              title={notes[cell.dateKey] || undefined}
              onClick={() => handleSelectDate(cell.dateKey)}
            >
              <span>{cell.day}</span>
              {(hasNote || hasDday) && (
                <span
                  className={`calendar-dot ${hasDday ? 'is-dday' : ''}`}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      <form className="calendar-note-form" onSubmit={handleNoteSubmit}>
        <div className="calendar-note-head">
          <label htmlFor="calendar-note-input" className="calendar-note-date">
            {selectedLabel} 메모
          </label>
          {savedNote && (
            <button
              type="button"
              className="widget-inline-clear"
              onClick={() => onSaveNote(selectedDateKey, '')}
              aria-label={`${selectedLabel} 메모 삭제`}
              title="메모 삭제"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
        {selectedDdays.length > 0 && (
          <p className="calendar-dday-chip">
            D-Day: {selectedDdays.map((item) => item.title).join(', ')}
          </p>
        )}
        <div className="calendar-note-row">
          <input
            id="calendar-note-input"
            type="text"
            value={noteInput}
            maxLength={MAX_CALENDAR_NOTE_LENGTH}
            placeholder="간단한 일정 메모 (Enter)"
            onChange={(event) => setNoteInput(event.target.value)}
            onBlur={() => {
              if (isDirty) onSaveNote(selectedDateKey, noteInput)
            }}
          />
          {isDirty && (
            <button type="submit" className="widget-chip-button is-primary">
              저장
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
