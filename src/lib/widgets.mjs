// 좌우 사이드 위젯(미니 캘린더, D-Day, 빠른 메모장, 포모도로 타이머) 공용 순수 로직 모듈입니다.

export const MAX_DDAYS = 20
export const MAX_DDAY_TITLE_LENGTH = 30
export const MAX_CALENDAR_NOTES = 200
export const MAX_CALENDAR_NOTE_LENGTH = 80
export const MAX_MEMO_LENGTH = 10_000
export const DEFAULT_FOCUS_MINUTES = 25
export const DEFAULT_BREAK_MINUTES = 5
export const FOCUS_PRESETS = [15, 25, 50]

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Date 객체를 로컬 타임존 기준 'YYYY-MM-DD' 문자열로 변환합니다.
 */
export function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 오늘 날짜를 로컬 타임존 기준 'YYYY-MM-DD'로 반환합니다.
 */
export function getTodayDateKey(now = new Date()) {
  return formatDateKey(now)
}

/**
 * 'YYYY-MM-DD' 문자열이 실제 존재하는 달력 날짜인지 검증하고 연/월/일을 반환합니다.
 */
export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null
  const match = DATE_KEY_PATTERN.exec(dateKey.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const candidate = new Date(year, month - 1, day)
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

/**
 * 특정 연/월의 미니 캘린더 셀 목록을 생성합니다. (일요일 시작)
 */
export function getCalendarGrid(year, month, todayKey = getTodayDateKey()) {
  const firstDay = new Date(year, month - 1, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7
  const cells = []

  for (let index = 0; index < totalCells; index += 1) {
    const cellDate = new Date(year, month - 1, 1 - startWeekday + index)
    const key = formatDateKey(cellDate)
    cells.push({
      dateKey: key,
      day: cellDate.getDate(),
      weekday: cellDate.getDay(),
      inCurrentMonth:
        cellDate.getFullYear() === year && cellDate.getMonth() === month - 1,
      isToday: key === todayKey,
    })
  }

  return cells
}

/**
 * 기준일(baseDateKey) 대비 목표일(targetDateKey)까지의 D-Day 일수와 배지 라벨을 계산합니다.
 * - diffDays > 0: 미래 (D-3)
 * - diffDays === 0: 당일 (D-Day)
 * - diffDays < 0: 과거 (D+2)
 */
export function calculateDdayDiff(targetDateKey, baseDateKey = getTodayDateKey()) {
  const target = parseDateKey(targetDateKey)
  const base = parseDateKey(baseDateKey)
  if (!target || !base) return null

  const targetUtc = Date.UTC(target.year, target.month - 1, target.day)
  const baseUtc = Date.UTC(base.year, base.month - 1, base.day)
  const diffDays = Math.round((targetUtc - baseUtc) / 86_400_000)

  let label = 'D-Day'
  let status = 'today'
  if (diffDays > 0) {
    label = `D-${diffDays}`
    status = diffDays <= 7 ? 'soon' : 'upcoming'
  } else if (diffDays < 0) {
    label = `D+${Math.abs(diffDays)}`
    status = 'past'
  }

  return { diffDays, label, status }
}

/**
 * D-Day 목록을 다가오는 일정(오늘 포함) 우선 오름차순, 지난 일정은 최근 순으로 정렬합니다.
 */
export function sortDdays(ddays, todayKey = getTodayDateKey()) {
  return [...ddays].sort((a, b) => {
    const diffA = calculateDdayDiff(a.targetDate, todayKey)?.diffDays ?? Number.MAX_SAFE_INTEGER
    const diffB = calculateDdayDiff(b.targetDate, todayKey)?.diffDays ?? Number.MAX_SAFE_INTEGER
    const aPast = diffA < 0
    const bPast = diffB < 0
    if (aPast !== bPast) return aPast ? 1 : -1
    if (!aPast) return diffA - diffB
    return diffB - diffA
  })
}

/**
 * 초 단위 시간을 'MM:SS' 문자열로 변환합니다.
 */
export function formatTimerSeconds(totalSeconds) {
  const clamped = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * 기본 위젯 데이터를 생성합니다.
 */
export function createDefaultWidgetData() {
  return {
    ddays: [],
    calendarNotes: {},
    memo: '',
    pomodoro: {
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      breakMinutes: DEFAULT_BREAK_MINUTES,
      completedSessions: 0,
    },
  }
}

/**
 * 외부 입력(localStorage, 백업 JSON)에서 위젯 데이터를 안전하게 정규화합니다.
 */
export function sanitizeWidgetData(raw) {
  const defaults = createDefaultWidgetData()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults

  const ddays = []
  if (Array.isArray(raw.ddays)) {
    const usedIds = new Set()
    for (const entry of raw.ddays.slice(0, MAX_DDAYS)) {
      if (!entry || typeof entry !== 'object') continue
      const title =
        typeof entry.title === 'string'
          ? entry.title.replace(/\s+/g, ' ').trim().slice(0, MAX_DDAY_TITLE_LENGTH)
          : ''
      const targetDate = typeof entry.targetDate === 'string' ? entry.targetDate.trim() : ''
      if (!title || !parseDateKey(targetDate)) continue

      let id =
        typeof entry.id === 'string' && entry.id.trim()
          ? entry.id.trim().slice(0, 80)
          : `dday-${ddays.length + 1}`
      if (usedIds.has(id)) id = `dday-${ddays.length + 1}-${Date.now()}`
      usedIds.add(id)

      const createdAt =
        typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : Date.now()

      ddays.push({ id, title, targetDate, createdAt })
    }
  }

  const calendarNotes = {}
  if (
    raw.calendarNotes &&
    typeof raw.calendarNotes === 'object' &&
    !Array.isArray(raw.calendarNotes)
  ) {
    let count = 0
    for (const [key, value] of Object.entries(raw.calendarNotes)) {
      if (count >= MAX_CALENDAR_NOTES) break
      if (!parseDateKey(key) || typeof value !== 'string') continue
      const note = value.replace(/\s+/g, ' ').trim().slice(0, MAX_CALENDAR_NOTE_LENGTH)
      if (!note) continue
      calendarNotes[key] = note
      count += 1
    }
  }

  const memo =
    typeof raw.memo === 'string' ? raw.memo.slice(0, MAX_MEMO_LENGTH) : ''

  const rawPomodoro =
    raw.pomodoro && typeof raw.pomodoro === 'object' && !Array.isArray(raw.pomodoro)
      ? raw.pomodoro
      : {}

  const focusMinutes =
    typeof rawPomodoro.focusMinutes === 'number' &&
    Number.isInteger(rawPomodoro.focusMinutes) &&
    rawPomodoro.focusMinutes >= 5 &&
    rawPomodoro.focusMinutes <= 90
      ? rawPomodoro.focusMinutes
      : DEFAULT_FOCUS_MINUTES

  const breakMinutes =
    typeof rawPomodoro.breakMinutes === 'number' &&
    Number.isInteger(rawPomodoro.breakMinutes) &&
    rawPomodoro.breakMinutes >= 1 &&
    rawPomodoro.breakMinutes <= 30
      ? rawPomodoro.breakMinutes
      : DEFAULT_BREAK_MINUTES

  const completedSessions =
    typeof rawPomodoro.completedSessions === 'number' &&
    Number.isInteger(rawPomodoro.completedSessions) &&
    rawPomodoro.completedSessions >= 0 &&
    rawPomodoro.completedSessions <= 99_999
      ? rawPomodoro.completedSessions
      : 0

  return {
    ddays,
    calendarNotes,
    memo,
    pomodoro: {
      focusMinutes,
      breakMinutes,
      completedSessions,
    },
  }
}
