import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  normalizeStoredSyncData,
  SCHEMA_VERSION,
} from './validation.mjs'

const STORE_VERSION = 1

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emptyDatabase() {
  return {
    version: STORE_VERSION,
    users: {},
    sessions: {},
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  }
}

function syncSnapshot(user) {
  const data = user.data
  if (!data) {
    return { version: 0, updatedAt: null, data: null }
  }

  return {
    version: data.version,
    updatedAt: data.updatedAt,
    data: {
      schemaVersion: data.schemaVersion ?? SCHEMA_VERSION,
      favorites: data.favorites,
      categories: data.categories,
      settings: data.settings,
    },
  }
}

export async function createStore({ dataDir, sessionTtlMs }) {
  const filePath = path.join(dataDir, 'store.json')
  let database = emptyDatabase()
  let writeChain = Promise.resolve()

  function runExclusive(task) {
    const run = writeChain.then(task, task)
    writeChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function save() {
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    const serialized = JSON.stringify(database, null, 2)

    try {
      await fs.writeFile(temporaryPath, serialized, { mode: 0o600 })
      await fs.rename(temporaryPath, filePath)
    } catch (error) {
      try {
        await fs.rm(temporaryPath, { force: true })
      } catch {
        // Ignore cleanup failures; the original error is more useful.
      }
      throw error
    }
  }

  function cleanupExpiredSessions() {
    const now = Date.now()
    for (const [tokenHash, session] of Object.entries(database.sessions)) {
      const expiresAt = Date.parse(session?.expiresAt)
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        delete database.sessions[tokenHash]
      }
    }
  }

  async function load() {
    await fs.mkdir(dataDir, { recursive: true })

    try {
      const text = await fs.readFile(filePath, 'utf8')
      const parsed = JSON.parse(text)
      if (!isRecord(parsed)) throw new Error('Store root must be an object.')

      database = {
        version: STORE_VERSION,
        users: isRecord(parsed.users) ? parsed.users : {},
        sessions: isRecord(parsed.sessions) ? parsed.sessions : {},
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        database = emptyDatabase()
        await save()
        return
      }

      const backupPath = `${filePath}.corrupt-${Date.now()}`
      try {
        await fs.rename(filePath, backupPath)
        console.error(
          `[sync] Could not read store.json. Moved it to ${backupPath} and started a new store.`,
        )
      } catch {
        console.error('[sync] Could not read store.json and could not create a backup.')
      }
      database = emptyDatabase()
      await save()
      return
    }

    for (const [id, user] of Object.entries(database.users)) {
      if (!isRecord(user) || typeof user.emailKey !== 'string') {
        delete database.users[id]
        continue
      }

      user.id = typeof user.id === 'string' ? user.id : id
      user.data = normalizeStoredSyncData(user.data)
    }

    cleanupExpiredSessions()
    await save()
  }

  function findUserByEmail(email) {
    const emailKey = String(email ?? '').trim().toLowerCase()
    return Object.values(database.users).find((user) => user.emailKey === emailKey) ?? null
  }

  function getUser(userId) {
    return database.users[userId] ?? null
  }

  function getSession(tokenHash) {
    const session = database.sessions[tokenHash]
    if (!session) return null

    const expiresAt = Date.parse(session.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      delete database.sessions[tokenHash]
      return null
    }
    return session
  }

  function getSyncSnapshot(userId) {
    const user = getUser(userId)
    return user ? syncSnapshot(user) : null
  }

  async function createUser({ email, passwordHash, passwordSalt }) {
    return runExclusive(async () => {
      const normalizedEmail = email.trim()
      const emailKey = normalizedEmail.toLowerCase()
      if (findUserByEmail(emailKey)) return null

      const user = {
        id: randomUUID(),
        email: normalizedEmail,
        emailKey,
        passwordHash,
        passwordSalt,
        createdAt: new Date().toISOString(),
        data: null,
      }

      database.users[user.id] = user
      await save()
      return user
    })
  }

  async function createSession(userId, tokenHash) {
    return runExclusive(async () => {
      cleanupExpiredSessions()
      const now = Date.now()
      const session = {
        userId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + sessionTtlMs).toISOString(),
      }
      database.sessions[tokenHash] = session
      await save()
      return session
    })
  }

  async function deleteSession(tokenHash) {
    return runExclusive(async () => {
      if (!database.sessions[tokenHash]) return false
      delete database.sessions[tokenHash]
      await save()
      return true
    })
  }

  async function updateSync(userId, baseVersion, data) {
    return runExclusive(async () => {
      const user = getUser(userId)
      if (!user) {
        return { ok: false, reason: 'not-found', snapshot: null }
      }

      const currentVersion = user.data?.version ?? 0
      if (baseVersion !== currentVersion) {
        return { ok: false, reason: 'conflict', snapshot: syncSnapshot(user) }
      }

      user.data = {
        schemaVersion: SCHEMA_VERSION,
        version: currentVersion + 1,
        updatedAt: new Date().toISOString(),
        favorites: structuredClone(data.favorites),
        categories: structuredClone(data.categories),
        settings: structuredClone(data.settings),
      }

      await save()
      return { ok: true, snapshot: syncSnapshot(user) }
    })
  }

  await load()

  return {
    filePath,
    findUserByEmail,
    getUser,
    getSession,
    getSyncSnapshot,
    createUser,
    createSession,
    deleteSession,
    updateSync,
    publicUser,
    close: async () => {
      await writeChain
    },
  }
}
