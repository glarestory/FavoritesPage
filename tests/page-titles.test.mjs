import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePageTitle, PAGE_TITLE_MAX_LENGTH } from '../src/lib/page-titles.mjs'

test('normalizePageTitle trims and collapses whitespace', () => {
  assert.equal(normalizePageTitle('  나의   시작  페이지 ', 'Fallback'), '나의 시작 페이지')
})

test('normalizePageTitle falls back for empty or non-string values', () => {
  assert.equal(normalizePageTitle('   ', 'Fallback'), 'Fallback')
  assert.equal(normalizePageTitle(undefined, 'Fallback'), 'Fallback')
  assert.equal(normalizePageTitle(42, 'Fallback'), 'Fallback')
})

test('normalizePageTitle limits the length', () => {
  const long = 'a'.repeat(PAGE_TITLE_MAX_LENGTH + 10)
  assert.equal(normalizePageTitle(long, 'Fallback').length, PAGE_TITLE_MAX_LENGTH)
})
