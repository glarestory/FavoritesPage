import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from './auth.mjs'
import { createStore } from './store.mjs'
import { validateSyncData } from './validation.mjs'

const SESSION_COOKIE = 'msp_session'

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...extraHeaders,
  })
  res.end(payload)
}

function sendEmpty(res, status, extraHeaders = {}) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end()
}

function sendText(res, status, text) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readCookie(req, name) {
  const header = req.headers.cookie
  if (!header) return null

  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const equals = trimmed.indexOf('=')
    if (equals < 0) continue
    if (trimmed.slice(0, equals) !== name) continue

    try {
      return decodeURIComponent(trimmed.slice(equals + 1))
    } catch {
      return null
    }
  }

  return null
}

function sessionCookie(token, config, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (config.cookieSecure) parts.push('Secure')
  return parts.join('; ')
}

function getAuth(req, store) {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const session = store.getSession(tokenHash)
  if (!session) return null

  const user = store.getUser(session.userId)
  if (!user) return null

  return { user, tokenHash }
}

function requireAuth(req, res, store) {
  const auth = getAuth(req, store)
  if (!auth) {
    sendJson(res, 401, { error: '로그인이 필요합니다.' })
    return null
  }
  return auth
}

async function readJson(req, limit) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json.')
  }

  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      throw new HttpError(413, '요청 본문이 너무 큽니다.')
    }
    chunks.push(chunk)
  }

  if (size === 0) {
    throw new HttpError(400, '요청 본문이 필요합니다.')
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.')
  }
}

function applyCors(req, res, config) {
  const origin = req.headers.origin
  if (!origin || config.corsOrigins.length === 0) return false
  if (!config.corsOrigins.includes(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  return true
}

async function handleAuthRegister(req, res, config, store) {
  const body = await readJson(req, config.maxBodyBytes)
  if (!isRecord(body)) {
    throw new HttpError(400, '요청 형식이 올바르지 않습니다.')
  }

  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  const credentialError = validateCredentials(email, password)
  if (credentialError) throw new HttpError(400, credentialError)

  if (store.findUserByEmail(email)) {
    throw new HttpError(409, '이미 가입된 이메일입니다.')
  }

  const { passwordHash, passwordSalt } = await hashPassword(password)
  const user = await store.createUser({ email, passwordHash, passwordSalt })
  if (!user) {
    throw new HttpError(409, '이미 가입된 이메일입니다.')
  }

  const token = createSessionToken()
  await store.createSession(user.id, hashSessionToken(token))

  sendJson(
    res,
    201,
    { user: store.publicUser(user) },
    { 'set-cookie': sessionCookie(token, config, config.sessionTtlMs / 1000) },
  )
}

async function handleAuthLogin(req, res, config, store) {
  const body = await readJson(req, config.maxBodyBytes)
  if (!isRecord(body)) {
    throw new HttpError(400, '요청 형식이 올바르지 않습니다.')
  }

  const email = normalizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    throw new HttpError(400, '이메일과 비밀번호를 입력해 주세요.')
  }

  const user = store.findUserByEmail(email)
  const valid = user
    ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
    : false
  if (!user || !valid) {
    throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  const token = createSessionToken()
  await store.createSession(user.id, hashSessionToken(token))

  sendJson(
    res,
    200,
    { user: store.publicUser(user) },
    { 'set-cookie': sessionCookie(token, config, config.sessionTtlMs / 1000) },
  )
}

async function handleAuthLogout(req, res, config, store) {
  const token = readCookie(req, SESSION_COOKIE)
  if (token) {
    await store.deleteSession(hashSessionToken(token))
  }
  sendEmpty(res, 204, { 'set-cookie': sessionCookie('', config, 0) })
}

async function handleApi(req, res, config, store) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { pathname } = url
  const method = req.method ?? 'GET'

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, { ok: true, service: 'my-start-page-sync', version: 1 })
    return
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    await handleAuthRegister(req, res, config, store)
    return
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    await handleAuthLogin(req, res, config, store)
    return
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    await handleAuthLogout(req, res, config, store)
    return
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const auth = requireAuth(req, res, store)
    if (!auth) return

    const snapshot = store.getSyncSnapshot(auth.user.id)
    sendJson(res, 200, {
      user: store.publicUser(auth.user),
      sync: {
        version: snapshot?.version ?? 0,
        updatedAt: snapshot?.updatedAt ?? null,
      },
    })
    return
  }

  if (pathname === '/api/sync' && method === 'GET') {
    const auth = requireAuth(req, res, store)
    if (!auth) return

    const snapshot = store.getSyncSnapshot(auth.user.id)
    if (!snapshot) {
      throw new HttpError(404, '사용자를 찾을 수 없습니다.')
    }
    sendJson(res, 200, snapshot)
    return
  }

  if (pathname === '/api/sync' && method === 'PUT') {
    const auth = requireAuth(req, res, store)
    if (!auth) return

    const body = await readJson(req, config.maxBodyBytes)
    if (!isRecord(body) || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) {
      throw new HttpError(400, 'baseVersion이 올바르지 않습니다.')
    }

    const validation = validateSyncData(body)
    if (!validation.ok) {
      throw new HttpError(400, validation.error)
    }

    const result = await store.updateSync(auth.user.id, body.baseVersion, validation.value)
    if (!result.ok) {
      if (result.reason === 'conflict') {
        sendJson(res, 409, {
          error: '다른 기기에서 데이터가 변경되었습니다.',
          current: result.snapshot,
        })
        return
      }
      throw new HttpError(404, '사용자를 찾을 수 없습니다.')
    }

    sendJson(res, 200, result.snapshot)
    return
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'API 경로를 찾을 수 없습니다.' })
    return
  }

  await serveStatic(req, res, pathname, config)
}

async function serveStatic(req, res, pathname, config) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, '허용되지 않은 메서드입니다.')
  }

  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    throw new HttpError(400, '잘못된 경로입니다.')
  }

  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  let filePath = path.resolve(config.staticDir, relativePath)
  if (filePath !== config.staticDir && !filePath.startsWith(`${config.staticDir}${path.sep}`)) {
    throw new HttpError(403, '접근할 수 없는 경로입니다.')
  }

  let stat = null
  try {
    stat = await fs.stat(filePath)
  } catch {
    stat = null
  }

  if (!stat || stat.isDirectory()) {
    if (path.extname(decoded)) {
      sendText(res, 404, 'Not found')
      return
    }

    filePath = path.join(config.staticDir, 'index.html')
    try {
      stat = await fs.stat(filePath)
    } catch {
      sendText(res, 404, 'Frontend build not found. Run "npm run build" first.')
      return
    }
  }

  const data = await fs.readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[extension] ?? 'application/octet-stream'
  const cacheControl = filePath.includes(`${path.sep}assets${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'content-type': contentType,
    'cache-control': cacheControl,
    'content-length': data.length,
  })

  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(data)
}

async function handleRequest(req, res, config, store) {
  applyCors(req, res, config)

  if (req.method === 'OPTIONS') {
    sendEmpty(res, 204)
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, config, store)
    return
  }

  await serveStatic(req, res, url.pathname, config)
}

export async function createAppServer(config) {
  const store = await createStore({
    dataDir: config.dataDir,
    sessionTtlMs: config.sessionTtlMs,
  })

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, config, store).catch((error) => {
      if (res.headersSent) {
        res.destroy()
        return
      }

      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message })
        return
      }

      console.error('[sync] Unhandled request error', error)
      sendJson(res, 500, { error: '서버 오류가 발생했습니다.' })
    })
  })

  const close = () =>
    new Promise((resolve, reject) => {
      if (!server.listening) {
        store.close().then(resolve, reject)
        return
      }

      server.close((error) => {
        store.close().then(
          () => (error ? reject(error) : resolve()),
          reject,
        )
      })
    })

  return { server, store, close }
}
