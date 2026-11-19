import type { DdayItem, WidgetData } from '../types'

export interface CalendarCell {
  dateKey: string
  day: number
  weekday: number
  inCurrentMonth: boolean
  isToday: boolean
}

export interface DdayDiff {
  diffDays: number
  label: string
  status: 'today' | 'soon' | 'upcoming' | 'past'
}

export declare const MAX_DDAYS: number
export declare const MAX_DDAY_TITLE_LENGTH: number
export declare const MAX_CALENDAR_NOTES: number
export declare const MAX_CALENDAR_NOTE_LENGTH: number
export declare const MAX_MEMO_LENGTH: number
export declare const DEFAULT_FOCUS_MINUTES: number
export declare const DEFAULT_BREAK_MINUTES: number
export declare const FOCUS_PRESETS: readonly number[]

export declare function formatDateKey(date: Date): string
export declare function getTodayDateKey(now?: Date): string
export declare function parseDateKey(
  dateKey: unknown,
): { year: number; month: number; day: number } | null
export declare function getCalendarGrid(
  year: number,
  month: number,
  todayKey?: string,
): CalendarCell[]
export declare function calculateDdayDiff(
  targetDateKey: string,
  baseDateKey?: string,
): DdayDiff | null
export declare function sortDdays(ddays: DdayItem[], todayKey?: string): DdayItem[]
export declare function formatTimerSeconds(totalSeconds: number): string
export declare function createDefaultWidgetData(): WidgetData
export declare function sanitizeWidgetData(raw: unknown): WidgetData
