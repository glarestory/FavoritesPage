import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultCategoryId } from '../src/lib/default-category.mjs'

const ALL = 'all'

test('getDefaultCategoryId picks the first category', () => {
  const categories = [{ id: 'dev' }, { id: 'ai' }]
  assert.equal(getDefaultCategoryId(categories, ALL), 'dev')
})

test('getDefaultCategoryId falls back to "all" when there are no categories', () => {
  assert.equal(getDefaultCategoryId([], ALL), ALL)
})
