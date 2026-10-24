import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createAppServer } from '../server/app.mjs'
import { getConfig } from '../server/config.mjs'

export async function startTestServer(
  overrides = {},
  { removeData = !overrides.DATA_DIR } = {},
) {
  const dataDir = overrides.DATA_DIR
    ? path.resolve(overrides.DATA_DIR)
    : await mkdtemp(path.join(os.tmpdir(), 'msp-sync-test-'))
  const config = getConfig({
    PORT: '0',
    HOST: '127.0.0.1',
    DATA_DIR: dataDir,
    SESSION_TTL_DAYS: '1',
    COOKIE_SECURE: 'false',
    MAX_BODY_BYTES: '1048576',
    ...overrides,
  })

  const { server, store, close } = await createAppServer(config)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    baseUrl,
    dataDir,
    server,
    store,
    async close({ removeData: shouldRemove = removeData } = {}) {
      await close()
      if (shouldRemove) {
        await rm(dataDir, { recursive: true, force: true })
      }
    },
  }
}

export function createClient(baseUrl) {
  let cookie = ''

  async function request(pathname, { method = 'GET', body, headers = {} } = {}) {
    const requestHeaders = { ...headers }
    if (body !== undefined) requestHeaders['content-type'] = 'application/json'
    if (cookie) requestHeaders.cookie = cookie

    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      const match = setCookie.match(/(?:^|,\s*)msp_session=([^;]*)/)
      if (match) cookie = match[1] ? `msp_session=${match[1]}` : ''
    }

    const text = await response.text()
    let json = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
    }

    return { response, status: response.status, json, text }
  }

  return {
    request,
    getCookie: () => cookie,
  }
}

export function sampleData() {
  return {
    favorites: [
      {
        id: 'fav-1',
        name: 'GitHub',
        url: 'https://github.com/',
        iconUrl: 'https://github.com/favicon.ico',
        categoryId: 'dev',
        createdAt: 1_700_000_000_000,
      },
      {
        id: 'fav-2',
        name: 'Naver',
        url: 'https://www.naver.com/',
        categoryId: 'news',
        createdAt: 1_700_000_000_001,
      },
    ],
    categories: [
      { id: 'dev', name: '개발' },
      { id: 'news', name: '뉴스' },
      { id: 'etc', name: '기타' },
    ],
    settings: {
      theme: 'light',
      searchEngine: 'google',
      background: { type: 'default' },
      openInNewTab: false,
    },
  }
}
