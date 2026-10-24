export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry))
  }

  if (value && typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value).sort()) {
      const next = value[key]
      if (next !== undefined) {
        result[key] = canonicalize(next)
      }
    }
    return result
  }

  return value
}

export function fingerprintSyncData(data) {
  return JSON.stringify(canonicalize(data))
}

/**
 * Server snapshots include schema metadata. Sync fingerprints must only cover
 * the user content so local and remote hashes can match.
 */
export function normalizeSyncData(data) {
  return {
    favorites: data.favorites,
    categories: data.categories,
    settings: data.settings,
  }
}

export function decideSyncAction({
  localFingerprint,
  remoteFingerprint,
  lastFingerprint,
}) {
  if (localFingerprint === remoteFingerprint) return 'none'
  if (!lastFingerprint) return 'conflict'
  if (localFingerprint === lastFingerprint) return 'pull'
  if (remoteFingerprint === lastFingerprint) return 'push'
  return 'conflict'
}

export function parseSyncMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const { fingerprint, remoteVersion, syncedAt } = value
  if (typeof fingerprint !== 'string' || fingerprint.length === 0) return null
  if (!Number.isInteger(remoteVersion) || remoteVersion < 0) return null
  if (typeof syncedAt !== 'string' || syncedAt.length === 0) return null

  return { fingerprint, remoteVersion, syncedAt }
}
