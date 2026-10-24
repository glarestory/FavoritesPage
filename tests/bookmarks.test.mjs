import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalBookmarkUrl,
  decodeHtmlEntities,
  parseChromeBookmarksHtml,
  planBookmarkImport,
} from '../src/lib/bookmarks-core.mjs'

const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1700000000">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://github.com/?tab=repositories&amp;sort=stars" ADD_DATE="1700000001">GitHub &amp; More</A>
    <DT><H3>AI Tools</H3>
    <DL><p>
      <DT><A HREF="https://chatgpt.com/?x=1&amp;y=2">ChatGPT &lt;AI&gt;</A>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Bad bookmark</A>
    <DT><A HREF="https://example.com/path/">   </A>
    <DT><A HREF="https://long.example.com/">${'L'.repeat(80)}</A>
  </DL><p>
</DL><p>`

test('parses Chrome bookmark HTML with folders, entities and validation issues', () => {
  const parsed = parseChromeBookmarksHtml(CHROME_EXPORT)

  assert.equal(parsed.items.length, 4)
  assert.equal(parsed.rejected.length, 1)
  assert.equal(parsed.rejected[0].title, 'Bad bookmark')
  assert.equal(parsed.rejected[0].reason, 'http:// 또는 https:// 주소만 가져올 수 있습니다.')

  const github = parsed.items.find((item) => item.title === 'GitHub & More')
  assert.ok(github)
  assert.deepEqual(github.folderPath, ['Bookmarks bar'])
  assert.equal(github.url, 'https://github.com/?tab=repositories&sort=stars')
  assert.equal(github.canonicalUrl, 'https://github.com?tab=repositories&sort=stars')
  assert.equal(github.createdAt, 1700000001000)

  const chatGpt = parsed.items.find((item) => item.url.includes('chatgpt.com'))
  assert.ok(chatGpt)
  assert.equal(chatGpt.title, 'ChatGPT <AI>')
  assert.deepEqual(chatGpt.folderPath, ['Bookmarks bar', 'AI Tools'])
  assert.equal(chatGpt.folderName, 'AI Tools')

  const noTitle = parsed.items.find((item) => item.url === 'https://example.com/path/')
  assert.ok(noTitle)
  assert.equal(noTitle.title, 'example.com')
  assert.match(noTitle.warning ?? '', /도메인으로 대체/)

  const longTitle = parsed.items.find((item) => item.url === 'https://long.example.com/')
  assert.ok(longTitle)
  assert.equal(longTitle.title.length, 60)
  assert.match(longTitle.warning ?? '', /60자로 잘렸습니다/)
})

test('decodes named and numeric HTML entities', () => {
  assert.equal(
    decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39; &#x1F600;'),
    '& < > " \' 😀',
  )
})

test('canonicalizes URLs for duplicate detection', () => {
  assert.equal(
    canonicalBookmarkUrl('https://Example.com/path/#section'),
    'https://example.com/path',
  )
  assert.equal(
    canonicalBookmarkUrl('https://example.com/?a=1'),
    'https://example.com?a=1',
  )
  assert.equal(canonicalBookmarkUrl('javascript:alert(1)'), '')
})

test('returns no items for an empty or unrelated HTML document', () => {
  assert.deepEqual(parseChromeBookmarksHtml('').items, [])
  assert.deepEqual(parseChromeBookmarksHtml('<html><body><p>Not bookmarks</p></body></html>').items, [])
})

test('merges selected bookmarks without overwriting skipped existing duplicates', () => {
  const parsed = parseChromeBookmarksHtml(CHROME_EXPORT)
  const github = parsed.items.find((item) => item.url.includes('github.com'))
  assert.ok(github)

  const existingFavorite = {
    id: 'favorite-existing',
    name: 'Old GitHub',
    url: 'https://github.com/?tab=repositories&sort=stars',
    categoryId: 'dev',
    createdAt: 123,
    iconUrl: 'https://github.com/favicon.ico',
  }
  const categories = [
    { id: 'dev', name: '개발' },
    { id: 'etc', name: '기타' },
  ]

  let categorySequence = 0
  let favoriteSequence = 0
  const result = planBookmarkImport({
    items: parsed.items,
    favorites: [existingFavorite],
    categories,
    useFolders: true,
    duplicatePolicy: 'skip',
    createCategoryId: (prefix = 'category') => `${prefix}-test-${++categorySequence}`,
    createFavoriteId: (prefix = 'favorite') => `${prefix}-test-${++favoriteSequence}`,
    now: 5000,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.value.stats.added, 3)
  assert.equal(result.value.stats.updated, 0)
  assert.equal(result.value.stats.skippedDuplicateExisting, 1)
  assert.equal(result.value.stats.categoriesCreated, 2)
  assert.equal(result.value.favorites[0].name, 'Old GitHub')
  assert.equal(result.value.favorites[0].iconUrl, 'https://github.com/favicon.ico')
  assert.equal(result.value.categories[0].name, '개발')
  assert.ok(result.value.categories.some((category) => category.name === 'AI Tools'))
  assert.ok(result.value.categories.some((category) => category.name === 'Bookmarks bar'))
})

test('updates an existing duplicate when replace is selected', () => {
  const parsed = parseChromeBookmarksHtml(CHROME_EXPORT)
  const github = parsed.items.find((item) => item.url.includes('github.com'))
  assert.ok(github)

  const result = planBookmarkImport({
    items: [github],
    favorites: [
      {
        id: 'favorite-existing',
        name: 'Old GitHub',
        url: 'https://github.com/?tab=repositories&sort=stars',
        categoryId: 'dev',
        createdAt: 123,
        iconUrl: 'https://github.com/favicon.ico',
      },
    ],
    categories: [
      { id: 'dev', name: '개발' },
      { id: 'etc', name: '기타' },
    ],
    useFolders: true,
    duplicatePolicy: 'replace',
    createCategoryId: (prefix = 'category') => `${prefix}-test`,
    createFavoriteId: (prefix = 'favorite') => `${prefix}-test`,
    now: 5000,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.value.stats.added, 0)
  assert.equal(result.value.stats.updated, 1)
  assert.equal(result.value.stats.skippedDuplicateExisting, 0)
  assert.equal(result.value.favorites.length, 1)
  assert.equal(result.value.favorites[0].id, 'favorite-existing')
  assert.equal(result.value.favorites[0].name, 'GitHub & More')
  assert.equal(result.value.favorites[0].createdAt, 123)
  assert.equal(result.value.favorites[0].iconUrl, 'https://github.com/favicon.ico')
  assert.notEqual(result.value.favorites[0].categoryId, 'dev')
})

test('keeps the first selected item for duplicate URLs within the imported file', () => {
  const items = [
    {
      key: 'bookmark-0',
      title: 'First title',
      url: 'https://example.com/',
      canonicalUrl: 'https://example.com',
      folderPath: ['Work'],
      folderName: 'Work',
      createdAt: null,
      warning: null,
    },
    {
      key: 'bookmark-1',
      title: 'Second title',
      url: 'https://example.com',
      canonicalUrl: 'https://example.com',
      folderPath: ['Work'],
      folderName: 'Work',
      createdAt: null,
      warning: null,
    },
  ]

  const result = planBookmarkImport({
    items,
    favorites: [],
    categories: [
      { id: 'dev', name: '개발' },
      { id: 'etc', name: '기타' },
    ],
    useFolders: true,
    duplicatePolicy: 'skip',
    createCategoryId: (prefix = 'category') => `${prefix}-test`,
    createFavoriteId: (prefix = 'favorite') => `${prefix}-test`,
    now: 9000,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.value.stats.added, 1)
  assert.equal(result.value.stats.skippedDuplicateFile, 1)
  assert.equal(result.value.favorites.length, 1)
  assert.equal(result.value.favorites[0].name, 'First title')
})

test('rejects an import that would exceed the favorite limit', () => {
  const favorites = Array.from({ length: 300 }, (_, index) => ({
    id: `favorite-${index}`,
    name: `Favorite ${index}`,
    url: `https://example.com/${index}`,
    categoryId: 'etc',
    createdAt: index,
  }))

  const result = planBookmarkImport({
    items: [
      {
        key: 'bookmark-0',
        title: 'One more',
        url: 'https://one-more.example.com/',
        canonicalUrl: 'https://one-more.example.com',
        folderPath: [],
        folderName: null,
        createdAt: null,
        warning: null,
      },
    ],
    favorites,
    categories: [{ id: 'etc', name: '기타' }],
    useFolders: true,
    duplicatePolicy: 'skip',
    now: 1000,
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.error, /최대 300개/)
})
