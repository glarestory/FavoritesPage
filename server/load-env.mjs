import fs from 'node:fs'
import path from 'node:path'

/**
 * Load a small .env file without adding a dependency.
 * Existing process environment variables always win.
 */
export function loadEnvFile(file = path.resolve(process.cwd(), '.env')) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equals = trimmed.indexOf('=')
    if (equals <= 0) continue

    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if (!key) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) process.env[key] = value
  }
}
