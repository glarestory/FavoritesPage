import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_CATEGORIES,
  normalizeStoredSyncData,
  validateSyncData,
} from '../server/validation.mjs'
import { sampleData } from './helpers.mjs'

test('valid sync data is normalized and accepted', () => {
  const result = validateSyncData(sampleData())
  assert.equal(result.ok, true)
  assert.equal(result.value.favorites.length, 2)
  assert.equal(result.value.categories.length, 3)
  assert.deepEqual(result.value.settings, sampleData().settings)
})

test('invalid categories are rejected', () => {
  const empty = sampleData()
  empty.categories = []
  const emptyResult = validateSyncData(empty)
  assert.equal(emptyResult.ok, false)
  assert.match(emptyResult.error, /카테고리/)

  const reserved = sampleData()
  reserved.categories.push({ id: 'all', name: '전체' })
  const reservedResult = validateSyncData(reserved)
  assert.equal(reservedResult.ok, false)

  const duplicate = sampleData()
  duplicate.categories.push({ id: 'dev-2', name: '개발' })
  const duplicateResult = validateSyncData(duplicate)
  assert.equal(duplicateResult.ok, false)
  assert.match(duplicateResult.error, /중복/)
})

test('favorites must reference an existing category and valid URL', () => {
  const unknownCategory = sampleData()
  unknownCategory.favorites[0].categoryId = 'missing'
  const categoryResult = validateSyncData(unknownCategory)
  assert.equal(categoryResult.ok, false)
  assert.match(categoryResult.error, /카테고리/)

  const invalidUrl = sampleData()
  invalidUrl.favorites[0].url = 'javascript:alert(1)'
  const urlResult = validateSyncData(invalidUrl)
  assert.equal(urlResult.ok, false)
  assert.match(urlResult.error, /http/)

  const duplicateUrl = sampleData()
  duplicateUrl.favorites[1].url = 'https://github.com/'
  const duplicateResult = validateSyncData(duplicateUrl)
  assert.equal(duplicateResult.ok, false)
  assert.match(duplicateResult.error, /중복/)
})

test('invalid settings are rejected', () => {
  const invalidTheme = sampleData()
  invalidTheme.settings.theme = 'sepia'
  assert.equal(validateSyncData(invalidTheme).ok, false)

  const invalidBackground = sampleData()
  invalidBackground.settings.background = { type: 'image', url: 'not-a-url', overlay: 0.5 }
  assert.equal(validateSyncData(invalidBackground).ok, false)

  const invalidOverlay = sampleData()
  invalidOverlay.settings.background = {
    type: 'image',
    url: 'https://example.com/background.jpg',
    overlay: 2,
  }
  assert.equal(validateSyncData(invalidOverlay).ok, false)
})

test('legacy stored data is migrated with default categories and settings', () => {
  const normalized = normalizeStoredSyncData({
    version: 4,
    updatedAt: '2026-01-01T00:00:00.000Z',
    favorites: [
      {
        name: 'Example',
        url: 'https://example.com',
        createdAt: 1,
      },
    ],
  })

  assert.ok(normalized)
  assert.equal(normalized.version, 4)
  assert.deepEqual(normalized.categories, DEFAULT_CATEGORIES)
  assert.equal(normalized.favorites.length, 1)
  assert.equal(normalized.favorites[0].categoryId, 'etc')
  assert.deepEqual(normalized.settings, {
    theme: 'light',
    searchEngine: 'google',
    background: { type: 'default' },
    openInNewTab: false,
  })
})

test('legacy nested data and invalid entries are normalized safely', () => {
  const normalized = normalizeStoredSyncData({
    version: 2,
    data: {
      categories: [{ id: 'custom', name: 'Custom' }],
      favorites: [
        { name: 'Valid', url: 'https://example.com', categoryId: 'missing', createdAt: 1 },
        { name: '', url: 'https://invalid.example', createdAt: 2 },
        { name: 'Bad URL', url: 'javascript:alert(1)', createdAt: 3 },
      ],
    },
  })

  assert.ok(normalized)
  assert.equal(normalized.categories.length, 1)
  assert.equal(normalized.favorites.length, 1)
  assert.equal(normalized.favorites[0].categoryId, 'custom')
  assert.equal(normalized.settings.theme, 'light')
})

test('null stored data stays null', () => {
  assert.equal(normalizeStoredSyncData(null), null)
  assert.equal(normalizeStoredSyncData(undefined), null)
})
