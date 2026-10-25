import assert from 'node:assert/strict'
import test from 'node:test'
import { getVisibleTabCount } from '../src/lib/category-overflow.mjs'

test('getVisibleTabCount shows every tab when they all fit', () => {
  const count = getVisibleTabCount({
    tabWidths: [60, 80, 70],
    containerWidth: 216,
    moreWidth: 70,
    gap: 3,
  })
  assert.equal(count, 3)
})

test('getVisibleTabCount reserves room for the more button when tabs overflow', () => {
  // all tabs need 216 > 215; available = 215 - 70 - 3 = 142 < 60 + 3 + 80 → 1 tab
  const count = getVisibleTabCount({
    tabWidths: [60, 80, 70],
    containerWidth: 215,
    moreWidth: 70,
    gap: 3,
  })
  assert.equal(count, 1)
})

test('getVisibleTabCount fits as many tabs as possible before the more button', () => {
  const count = getVisibleTabCount({
    tabWidths: [50, 50, 50, 50, 50, 50],
    containerWidth: 300,
    moreWidth: 60,
    gap: 4,
  })
  // available = 300 - 60 - 4 = 236 → 4 tabs = 4*50 + 3*4 = 212, 5 tabs = 266
  assert.equal(count, 4)
})

test('getVisibleTabCount matches the exact boundary', () => {
  const count = getVisibleTabCount({
    tabWidths: [50, 50, 50, 50, 50],
    containerWidth: 50 + 4 + 50 + 4 + 60,
    moreWidth: 60,
    gap: 4,
  })
  assert.equal(count, 2)
})

test('getVisibleTabCount always keeps at least one tab visible', () => {
  assert.equal(
    getVisibleTabCount({ tabWidths: [120, 80], containerWidth: 100, moreWidth: 60, gap: 3 }),
    1,
  )
  assert.equal(
    getVisibleTabCount({ tabWidths: [120, 80], containerWidth: 0, moreWidth: 60, gap: 3 }),
    1,
  )
})

test('getVisibleTabCount handles an empty tab list', () => {
  assert.equal(
    getVisibleTabCount({ tabWidths: [], containerWidth: 300, moreWidth: 60, gap: 3 }),
    0,
  )
})
