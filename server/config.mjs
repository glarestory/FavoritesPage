import path from 'node:path'

function readInteger(value, fallback, { min, max, name }) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`)
  }
  return parsed
}

function readBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  throw new Error(`${name} must be true or false.`)
}

export function getConfig(env = process.env) {
  const sessionTtlDays = readInteger(env.SESSION_TTL_DAYS, 30, {
    min: 1,
    max: 365,
    name: 'SESSION_TTL_DAYS',
  })

  const corsOrigins = String(env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return {
    host: String(env.HOST ?? '').trim() || '127.0.0.1',
    port: readInteger(env.PORT, 8787, { min: 0, max: 65535, name: 'PORT' }),
    dataDir: path.resolve(process.cwd(), String(env.DATA_DIR ?? '').trim() || 'data'),
    sessionTtlMs: sessionTtlDays * 24 * 60 * 60 * 1000,
    cookieSecure: readBoolean(env.COOKIE_SECURE, false, 'COOKIE_SECURE'),
    maxBodyBytes: readInteger(env.MAX_BODY_BYTES, 1024 * 1024, {
      min: 1024,
      max: 10 * 1024 * 1024,
      name: 'MAX_BODY_BYTES',
    }),
    corsOrigins,
    staticDir: path.resolve(process.cwd(), 'dist'),
  }
}
