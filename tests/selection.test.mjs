import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getVisibleSelectionState,
  moveFavoritesToCategory,
  pruneSelectionIds,
  removeFavoritesByIds,
  toggleSelectAllVisible,
  toggleSelectionId,
} from '../src/lib/selection.mjs'

const SAMPLE_FAVORITES = [
  { id: 'f1', name: 'GitHub', url: 'https://github.com/', categoryId: 'dev', createdAt: 1 },
  { id: 'f2', name: 'ChatGPT', url: 'https://chatgpt.com/', categoryId: 'ai', createdAt: 2 },
  { id: 'f3', name: 'Claude', url: 'https://claude.ai/', categoryId: 'ai', createdAt: 3 },
  { id: 'f4', name: 'Naver', url: 'https://naver.com/', categoryId: 'news', createdAt: 4 },
]

test('toggleSelectionId adds and removes ids immutably', () => {
  const initial = ['f1']
  const added = toggleSelectionId(initial, 'f2')
  assert.deepEqual(added, ['f1', 'f2'])
  assert.deepEqual(initial, ['f1'])

  const removed = toggleSelectionId(added, 'f1')
  assert.deepEqual(removed, ['f2'])
})

test('getVisibleSelectionState computes checked and indeterminate states', () => {
  assert.deepEqual(getVisibleSelectionState([], ['f1', 'f2']), {
    visibleSelectedCount: 0,
    allVisibleSelected: false,
    someVisibleSelected: false,
  })
  assert.deepEqual(getVisibleSelectionState(['f1'], ['f1', 'f2']), {
    visibleSelectedCount: 1,
    allVisibleSelected: false,
    someVisibleSelected: true,
  })
  assert.deepEqual(getVisibleSelectionState(['f1', 'f2', 'f4'], ['f1', 'f2']), {
    visibleSelectedCount: 2,
    allVisibleSelected: true,
    someVisibleSelected: false,
  })
})

test('toggleSelectAllVisible selects or clears only visible items while keeping other tabs', () => {
  const selected = toggleSelectAllVisible(['f4'], ['f2', 'f3'])
  assert.deepEqual(selected, ['f4', 'f2', 'f3'])

  const clearedVisible = toggleSelectAllVisible(selected, ['f2', 'f3'])
  assert.deepEqual(clearedVisible, ['f4'])
})

test('pruneSelectionIds drops ids that no longer exist', () => {
  assert.deepEqual(pruneSelectionIds(['f1', 'deleted', 'f3'], SAMPLE_FAVORITES), ['f1', 'f3'])
})

test('removeFavoritesByIds deletes selected favorites and reports removed count', () => {
  const result = removeFavoritesByIds(SAMPLE_FAVORITES, ['f2', 'f4', 'unknown'])
  assert.equal(result.removedCount, 2)
  assert.deepEqual(
    result.favorites.map((item) => item.id),
    ['f1', 'f3'],
  )
})

test('moveFavoritesToCategory moves only favorites in a different category', () => {
  const result = moveFavoritesToCategory(SAMPLE_FAVORITES, ['f1', 'f2', 'f3'], 'ai')
  assert.equal(result.movedCount, 1)
  assert.deepEqual(
    result.favorites.map((item) => [item.id, item.categoryId]),
    [
      ['f1', 'ai'],
      ['f2', 'ai'],
      ['f3', 'ai'],
      ['f4', 'news'],
    ],
  )
})
