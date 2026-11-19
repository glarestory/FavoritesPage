import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decodeSyncChunks,
  encodeSyncChunks,
  getObsoleteChunkKeys,
  getUtf8ByteLength,
  mergeChromeStorageState,
  splitStateForChromeStorage,
  splitStringByUtf8Bytes,
  SYNC_CHUNK_PREFIX,
  SYNC_META_KEY,
} from '../src/lib/extension-sync-core.mjs'

const SAMPLE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII='

test('splitStateForChromeStorage separates local background and local favorite icons from sync payload', () => {
  const state = {
    favorites: [
      {
        id: 'fav-1',
        name: '로컬 아이콘 사이트',
        url: 'https://example.com/',
        iconUrl: SAMPLE_DATA_URL,
        categoryId: 'dev',
        createdAt: 1,
      },
      {
        id: 'fav-2',
        name: '외부 아이콘 사이트',
        url: 'https://github.com/',
        iconUrl: 'https://github.com/favicon.ico',
        iconEmoji: '🚀',
        categoryId: 'dev',
        createdAt: 2,
      },
    ],
    categories: [{ id: 'dev', name: '개발' }],
    settings: {
      theme: 'dark',
      searchEngine: 'google',
      background: {
        type: 'image',
        url: SAMPLE_DATA_URL,
        overlay: 0.45,
        source: 'local',
        fileName: 'wallpaper.png',
      },
      openInNewTab: false,
      siteTitle: 'My Start Page',
      heroTitle: 'My Homepage',
      showSideWidgets: true,
    },
    widgets: {
      ddays: [],
      calendarNotes: { '2026-11-19': '배포일' },
      memo: '동기화 테스트 메모',
      pomodoro: { focusMinutes: 25, breakMinutes: 5, completedSessions: 2 },
    },
  }

  const { syncPayload, localMedia } = splitStateForChromeStorage(state)

  // syncPayload에는 대용량 data URL이 포함되지 않습니다.
  assert.equal('iconUrl' in syncPayload.favorites[0], false)
  assert.equal(syncPayload.favorites[1].iconUrl, 'https://github.com/favicon.ico')
  assert.deepEqual(syncPayload.settings.background, { type: 'default' })

  // localMedia에는 로컬 배경 이미지와 로컬 아이콘이 분리 보관됩니다.
  assert.equal(localMedia.localBackground?.fileName, 'wallpaper.png')
  assert.equal(localMedia.localFavoriteIcons['fav-1'], SAMPLE_DATA_URL)
  assert.equal(localMedia.localFavoriteIcons['fav-2'], undefined)

  // 병합 시 현재 기기의 로컬 배경과 로컬 아이콘이 복원됩니다.
  const merged = mergeChromeStorageState(syncPayload, localMedia)
  assert.equal(merged.favorites[0].iconUrl, SAMPLE_DATA_URL)
  assert.equal(merged.settings.background.type, 'image')
  assert.equal(merged.settings.background.fileName, 'wallpaper.png')
})

test('mergeChromeStorageState respects explicit non-default synced background over local media', () => {
  const merged = mergeChromeStorageState(
    {
      favorites: [],
      categories: [],
      settings: {
        theme: 'light',
        background: { type: 'color', color: '#eef3fb' },
      },
      widgets: {},
    },
    {
      localBackground: {
        type: 'image',
        url: SAMPLE_DATA_URL,
        overlay: 0.45,
        source: 'local',
      },
      localFavoriteIcons: {},
    },
  )

  assert.deepEqual(merged.settings.background, { type: 'color', color: '#eef3fb' })
})

test('splitStringByUtf8Bytes splits Korean and emoji strings without exceeding byte limits', () => {
  const text = '한글과🚀이모지가섞인긴문자열'.repeat(40)
  const chunks = splitStringByUtf8Bytes(text, 120)
  assert.ok(chunks.length > 1)
  for (const chunk of chunks) {
    assert.ok(getUtf8ByteLength(chunk) <= 120)
  }
  assert.equal(chunks.join(''), text)
})

test('encodeSyncChunks and decodeSyncChunks round-trip multi-chunk payloads', () => {
  const payload = {
    memo: '가나다라마바사 '.repeat(300),
    favorites: [{ id: '1', name: 'GitHub', url: 'https://github.com/' }],
  }

  const encoded = encodeSyncChunks(payload, {
    clientId: 'client-test',
    updatedAt: 1_700_000_000_000,
    maxChunkBytes: 512,
  })
  assert.equal(encoded.ok, true)
  assert.ok(encoded.chunkCount > 1)
  assert.ok(SYNC_META_KEY in encoded.items)

  const decoded = decodeSyncChunks(encoded.items)
  assert.ok(decoded)
  assert.deepEqual(decoded.payload, payload)
  assert.equal(decoded.clientId, 'client-test')
  assert.equal(decoded.updatedAt, 1_700_000_000_000)
})

test('encodeSyncChunks rejects payloads exceeding total sync quota', () => {
  const oversized = { memo: 'a'.repeat(100_000) }
  const encoded = encodeSyncChunks(oversized, { maxTotalBytes: 96_000 })
  assert.equal(encoded.ok, false)
  assert.match(encoded.error, /100KB/)
})

test('getObsoleteChunkKeys identifies stale trailing chunks to remove', () => {
  const existingKeys = [
    SYNC_META_KEY,
    `${SYNC_CHUNK_PREFIX}0`,
    `${SYNC_CHUNK_PREFIX}1`,
    `${SYNC_CHUNK_PREFIX}2`,
    `${SYNC_CHUNK_PREFIX}3`,
  ]
  assert.deepEqual(getObsoleteChunkKeys(existingKeys, 2), [
    `${SYNC_CHUNK_PREFIX}2`,
    `${SYNC_CHUNK_PREFIX}3`,
  ])
})
