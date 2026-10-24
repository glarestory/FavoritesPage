import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canonicalize,
  decideSyncAction,
  fingerprintSyncData,
  normalizeSyncData,
  parseSyncMeta,
} from '../src/lib/sync-core.mjs'

test('fingerprints are independent of object key order', () => {
  const first = {
    favorites: [{ id: '1', name: 'GitHub', url: 'https://github.com/' }],
    categories: [{ id: 'dev', name: '개발' }],
    settings: { theme: 'light', openInNewTab: false },
  }
  const second = {
    settings: { openInNewTab: false, theme: 'light' },
    categories: [{ name: '개발', id: 'dev' }],
    favorites: [{ url: 'https://github.com/', name: 'GitHub', id: '1' }],
  }

  assert.equal(fingerprintSyncData(first), fingerprintSyncData(second))
  assert.deepEqual(canonicalize({ b: 1, a: 2 }), { a: 2, b: 1 })
})

test('sync content normalization removes server schema metadata', () => {
  const content = {
    favorites: [{ id: '1', name: 'GitHub', url: 'https://github.com/' }],
    categories: [{ id: 'dev', name: '개발' }],
    settings: { theme: 'light', openInNewTab: false },
  }
  const snapshot = { schemaVersion: 1, ...content }

  assert.deepEqual(normalizeSyncData(snapshot), content)
  assert.notEqual(
    fingerprintSyncData(snapshot),
    fingerprintSyncData(normalizeSyncData(snapshot)),
  )
  assert.equal(
    fingerprintSyncData(content),
    fingerprintSyncData(normalizeSyncData(snapshot)),
  )
})

test('array order is significant', () => {
  const first = { favorites: [{ id: '1' }, { id: '2' }] }
  const second = { favorites: [{ id: '2' }, { id: '1' }] }
  assert.notEqual(fingerprintSyncData(first), fingerprintSyncData(second))
})

test('sync action decides between none, pull, push, and conflict', () => {
  assert.equal(
    decideSyncAction({
      localFingerprint: 'same',
      remoteFingerprint: 'same',
      lastFingerprint: null,
    }),
    'none',
  )

  assert.equal(
    decideSyncAction({
      localFingerprint: 'local',
      remoteFingerprint: 'remote',
      lastFingerprint: null,
    }),
    'conflict',
  )

  assert.equal(
    decideSyncAction({
      localFingerprint: 'last',
      remoteFingerprint: 'remote',
      lastFingerprint: 'last',
    }),
    'pull',
  )

  assert.equal(
    decideSyncAction({
      localFingerprint: 'local',
      remoteFingerprint: 'last',
      lastFingerprint: 'last',
    }),
    'push',
  )

  assert.equal(
    decideSyncAction({
      localFingerprint: 'local',
      remoteFingerprint: 'remote',
      lastFingerprint: 'last',
    }),
    'conflict',
  )
})

test('sync metadata is parsed only when valid', () => {
  assert.deepEqual(
    parseSyncMeta({
      fingerprint: 'abc',
      remoteVersion: 3,
      syncedAt: '2026-01-01T00:00:00.000Z',
    }),
    {
      fingerprint: 'abc',
      remoteVersion: 3,
      syncedAt: '2026-01-01T00:00:00.000Z',
    },
  )

  assert.equal(parseSyncMeta(null), null)
  assert.equal(parseSyncMeta({ fingerprint: '', remoteVersion: 1, syncedAt: 'x' }), null)
  assert.equal(parseSyncMeta({ fingerprint: 'a', remoteVersion: -1, syncedAt: 'x' }), null)
  assert.equal(parseSyncMeta({ fingerprint: 'a', remoteVersion: 1, syncedAt: '' }), null)
})
