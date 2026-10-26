import assert from 'node:assert/strict'
import test from 'node:test'
import { canDropFavoriteOnCategory } from '../src/lib/category-drop.mjs'

const ALL = 'all'

test('a dragged favorite can be dropped on another category', () => {
  assert.equal(canDropFavoriteOnCategory('ai', 'dev', ALL), true)
})

test('dropping on the current category or the "all" tab is not allowed', () => {
  assert.equal(canDropFavoriteOnCategory('dev', 'dev', ALL), false)
  assert.equal(canDropFavoriteOnCategory(ALL, 'dev', ALL), false)
})

test('nothing is droppable when no favorite is being dragged', () => {
  assert.equal(canDropFavoriteOnCategory('ai', null, ALL), false)
})
