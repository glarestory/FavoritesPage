import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createClient,
  sampleData,
  startTestServer,
} from './helpers.mjs'

const EMAIL = 'sync@example.com'
const PASSWORD = 'correct horse battery staple'

async function register(client, email = EMAIL, password = PASSWORD) {
  return client.request('/api/auth/register', {
    method: 'POST',
    body: { email, password },
  })
}

test('health endpoint is public and sync endpoints require authentication', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())
  const client = createClient(server.baseUrl)

  const health = await client.request('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.json.ok, true)

  const sync = await client.request('/api/sync')
  assert.equal(sync.status, 401)
  assert.match(sync.json.error, /로그인/)

  const me = await client.request('/api/auth/me')
  assert.equal(me.status, 401)
})

test('register, push, pull, and logout lifecycle', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())
  const first = createClient(server.baseUrl)

  const registered = await register(first)
  assert.equal(registered.status, 201)
  assert.equal(registered.json.user.email, EMAIL)
  assert.ok(first.getCookie().startsWith('msp_session='))

  const me = await first.request('/api/auth/me')
  assert.equal(me.status, 200)
  assert.equal(me.json.sync.version, 0)

  const empty = await first.request('/api/sync')
  assert.equal(empty.status, 200)
  assert.equal(empty.json.version, 0)
  assert.equal(empty.json.data, null)

  const data = sampleData()
  const pushed = await first.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 0, ...data },
  })
  assert.equal(pushed.status, 200)
  assert.equal(pushed.json.version, 1)
  assert.equal(pushed.json.data.favorites.length, 2)
  assert.equal(pushed.json.data.categories.length, 3)

  const pulled = await first.request('/api/sync')
  assert.equal(pulled.status, 200)
  assert.deepEqual(pulled.json.data.favorites, data.favorites)
  assert.deepEqual(pulled.json.data.categories, data.categories)
  assert.deepEqual(pulled.json.data.settings, data.settings)

  const second = createClient(server.baseUrl)
  const loggedIn = await second.request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  assert.equal(loggedIn.status, 200)

  const secondPull = await second.request('/api/sync')
  assert.equal(secondPull.status, 200)
  assert.equal(secondPull.json.version, 1)
  assert.deepEqual(secondPull.json.data.favorites, data.favorites)

  const loggedOut = await second.request('/api/auth/logout', { method: 'POST' })
  assert.equal(loggedOut.status, 204)

  const afterLogout = await second.request('/api/sync')
  assert.equal(afterLogout.status, 401)
})

test('stale writes return a conflict with the current server snapshot', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())

  const deviceA = createClient(server.baseUrl)
  const deviceB = createClient(server.baseUrl)
  await register(deviceA)
  const loginB = await deviceB.request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  assert.equal(loginB.status, 200)

  const data = sampleData()
  const initial = await deviceA.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 0, ...data },
  })
  assert.equal(initial.status, 200)

  const changed = sampleData()
  changed.favorites[0].name = 'GitHub changed on B'
  const fromB = await deviceB.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 1, ...changed },
  })
  assert.equal(fromB.status, 200)
  assert.equal(fromB.json.version, 2)

  const stale = await deviceA.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 1, ...data },
  })
  assert.equal(stale.status, 409)
  assert.match(stale.json.error, /다른 기기/)
  assert.equal(stale.json.current.version, 2)
  assert.equal(stale.json.current.data.favorites[0].name, 'GitHub changed on B')
})

test('invalid payloads are rejected without changing the stored version', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())
  const client = createClient(server.baseUrl)
  await register(client)

  const invalidCategory = sampleData()
  invalidCategory.favorites[0].categoryId = 'missing-category'
  const categoryResponse = await client.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 0, ...invalidCategory },
  })
  assert.equal(categoryResponse.status, 400)
  assert.match(categoryResponse.json.error, /카테고리/)

  const duplicateUrl = sampleData()
  duplicateUrl.favorites[1].url = 'https://github.com/'
  const duplicateResponse = await client.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 0, ...duplicateUrl },
  })
  assert.equal(duplicateResponse.status, 400)
  assert.match(duplicateResponse.json.error, /중복/)

  const invalidVersion = await client.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: -1, ...sampleData() },
  })
  assert.equal(invalidVersion.status, 400)

  const unchanged = await client.request('/api/sync')
  assert.equal(unchanged.status, 200)
  assert.equal(unchanged.json.version, 0)
})

test('duplicate registration and wrong passwords are rejected', async (t) => {
  const server = await startTestServer()
  t.after(() => server.close())
  const client = createClient(server.baseUrl)

  const first = await register(client)
  assert.equal(first.status, 201)

  const duplicate = await register(createClient(server.baseUrl))
  assert.equal(duplicate.status, 409)

  const wrong = await createClient(server.baseUrl).request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: 'wrong-password' },
  })
  assert.equal(wrong.status, 401)

  const shortPassword = await register(
    createClient(server.baseUrl),
    'other@example.com',
    'short',
  )
  assert.equal(shortPassword.status, 400)
})

test('users and sessions survive a server restart', async (t) => {
  const firstServer = await startTestServer()
  const data = sampleData()
  const client = createClient(firstServer.baseUrl)
  await register(client)
  const pushed = await client.request('/api/sync', {
    method: 'PUT',
    body: { baseVersion: 0, ...data },
  })
  assert.equal(pushed.status, 200)
  const dataDir = firstServer.dataDir
  await firstServer.close({ removeData: false })

  const secondServer = await startTestServer(
    { DATA_DIR: dataDir },
    { removeData: true },
  )
  t.after(() => secondServer.close())

  const secondClient = createClient(secondServer.baseUrl)
  const loggedIn = await secondClient.request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  assert.equal(loggedIn.status, 200)

  const pulled = await secondClient.request('/api/sync')
  assert.equal(pulled.status, 200)
  assert.equal(pulled.json.version, 1)
  assert.deepEqual(pulled.json.data.favorites, data.favorites)
})
