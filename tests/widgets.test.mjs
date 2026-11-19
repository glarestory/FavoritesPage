import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateDdayDiff,
  createDefaultWidgetData,
  formatDateKey,
  formatTimerSeconds,
  getCalendarGrid,
  parseDateKey,
  sanitizeWidgetData,
  sortDdays,
} from '../src/lib/widgets.mjs'

test('formatDateKey and parseDateKey validate real calendar dates', () => {
  assert.equal(formatDateKey(new Date(2026, 10, 19)), '2026-11-19')
  assert.deepEqual(parseDateKey('2026-11-19'), { year: 2026, month: 11, day: 19 })
  assert.equal(parseDateKey('2026-02-30'), null)
  assert.equal(parseDateKey('invalid'), null)
})

test('getCalendarGrid builds complete weeks and marks today accurately', () => {
  const cells = getCalendarGrid(2026, 11, '2026-11-19')
  assert.equal(cells.length % 7, 0)
  assert.equal(cells[0].weekday, 0)
  const todayCell = cells.find((cell) => cell.dateKey === '2026-11-19')
  assert.ok(todayCell)
  assert.equal(todayCell.isToday, true)
  assert.equal(todayCell.inCurrentMonth, true)
})

test('calculateDdayDiff returns today, soon, upcoming, and past labels', () => {
  assert.deepEqual(calculateDdayDiff('2026-11-19', '2026-11-19'), {
    diffDays: 0,
    label: 'D-Day',
    status: 'today',
  })
  assert.deepEqual(calculateDdayDiff('2026-11-22', '2026-11-19'), {
    diffDays: 3,
    label: 'D-3',
    status: 'soon',
  })
  assert.deepEqual(calculateDdayDiff('2026-12-25', '2026-11-19'), {
    diffDays: 36,
    label: 'D-36',
    status: 'upcoming',
  })
  assert.deepEqual(calculateDdayDiff('2026-11-15', '2026-11-19'), {
    diffDays: -4,
    label: 'D+4',
    status: 'past',
  })
})

test('sortDdays prioritizes today and upcoming dates before past dates', () => {
  const sorted = sortDdays(
    [
      { id: 'past-old', title: '오래된 일정', targetDate: '2026-11-01', createdAt: 1 },
      { id: 'far', title: '먼 일정', targetDate: '2026-12-10', createdAt: 2 },
      { id: 'today', title: '오늘 마감', targetDate: '2026-11-19', createdAt: 3 },
      { id: 'past-recent', title: '어제 일정', targetDate: '2026-11-18', createdAt: 4 },
      { id: 'soon', title: '내일 일정', targetDate: '2026-11-20', createdAt: 5 },
    ],
    '2026-11-19',
  )
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['today', 'soon', 'far', 'past-recent', 'past-old'],
  )
})

test('formatTimerSeconds formats seconds into MM:SS', () => {
  assert.equal(formatTimerSeconds(1500), '25:00')
  assert.equal(formatTimerSeconds(65), '01:05')
  assert.equal(formatTimerSeconds(0), '00:00')
  assert.equal(formatTimerSeconds(-5), '00:00')
})

test('sanitizeWidgetData normalizes valid data and ignores invalid entries', () => {
  assert.deepEqual(sanitizeWidgetData(null), createDefaultWidgetData())

  const sanitized = sanitizeWidgetData({
    ddays: [
      { id: 'd1', title: '  배포   마감 ', targetDate: '2026-12-01', createdAt: 100 },
      { id: 'd2', title: '잘못된 날짜', targetDate: '2026-02-31', createdAt: 101 },
    ],
    calendarNotes: {
      '2026-11-19': '  오전   회의  ',
      '2026-99-99': '무시됨',
      '2026-11-20': '   ',
    },
    memo: '메모 내용',
    pomodoro: {
      focusMinutes: 50,
      breakMinutes: 10,
      completedSessions: 4,
    },
  })

  assert.equal(sanitized.ddays.length, 1)
  assert.equal(sanitized.ddays[0].title, '배포 마감')
  assert.deepEqual(sanitized.calendarNotes, { '2026-11-19': '오전 회의' })
  assert.equal(sanitized.memo, '메모 내용')
  assert.deepEqual(sanitized.pomodoro, {
    focusMinutes: 50,
    breakMinutes: 10,
    completedSessions: 4,
  })
})
