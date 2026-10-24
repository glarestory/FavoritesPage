import { useCallback, useEffect, useRef, useState } from 'react'
import type { Category, Favorite, Settings } from '../types'
import type { AuthUser, SyncData, SyncSnapshot } from '../lib/api'
import { ApiError, api } from '../lib/api'
import {
  clearSyncMeta,
  decideSyncAction,
  fingerprintSyncData,
  hasSessionHint,
  loadSyncMeta,
  normalizeSyncData,
  saveSyncMeta,
  setSessionHint,
  toSyncData,
} from '../lib/sync'

export type SyncStatus = 'idle' | 'authenticating' | 'syncing' | 'error' | 'conflict'

export interface SyncConflict {
  local: SyncData
  remote: SyncSnapshot
}

export interface SyncController {
  session: AuthUser | null
  status: SyncStatus
  error: string | null
  conflict: SyncConflict | null
  lastSyncedAt: string | null
  remoteVersion: number | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  syncNow: () => Promise<void>
  resolveConflict: (choice: 'local' | 'server') => Promise<void>
  clearError: () => void
}

interface UseSyncOptions {
  favorites: Favorite[]
  categories: Category[]
  settings: Settings
  onApplyRemote: (data: SyncData) => void
}

export function useSync({
  favorites,
  categories,
  settings,
  onApplyRemote,
}: UseSyncOptions): SyncController {
  const [session, setSession] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => loadSyncMeta()?.syncedAt ?? null,
  )
  const [remoteVersion, setRemoteVersion] = useState<number | null>(
    () => loadSyncMeta()?.remoteVersion ?? null,
  )

  const favoritesRef = useRef(favorites)
  const categoriesRef = useRef(categories)
  const settingsRef = useRef(settings)
  const onApplyRemoteRef = useRef(onApplyRemote)
  const sessionRef = useRef<AuthUser | null>(null)
  const conflictRef = useRef<SyncConflict | null>(null)
  const syncInFlightRef = useRef(false)
  const autoSyncFingerprintRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  favoritesRef.current = favorites
  categoriesRef.current = categories
  settingsRef.current = settings
  onApplyRemoteRef.current = onApplyRemote

  const updateSession = useCallback((next: AuthUser | null) => {
    sessionRef.current = next
    if (mountedRef.current) setSession(next)
  }, [])

  const updateConflict = useCallback((next: SyncConflict | null) => {
    conflictRef.current = next
    if (mountedRef.current) setConflict(next)
  }, [])

  const getLocalData = useCallback(
    () => toSyncData(favoritesRef.current, categoriesRef.current, settingsRef.current),
    [],
  )

  const applyRemoteData = useCallback((data: SyncData) => {
    const normalized = normalizeSyncData(data)
    autoSyncFingerprintRef.current = fingerprintSyncData(normalized)
    onApplyRemoteRef.current(normalized)
  }, [])

  const markSynced = useCallback((snapshot: SyncSnapshot, data: SyncData) => {
    const normalized = normalizeSyncData(data)
    const fingerprint = fingerprintSyncData(normalized)
    const syncedAt = snapshot.updatedAt ?? new Date().toISOString()
    saveSyncMeta({
      fingerprint,
      remoteVersion: snapshot.version,
      syncedAt,
    })
    autoSyncFingerprintRef.current = fingerprint

    if (mountedRef.current) {
      setLastSyncedAt(syncedAt)
      setRemoteVersion(snapshot.version)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!sessionRef.current) return
    if (syncInFlightRef.current) return
    if (conflictRef.current) return

    syncInFlightRef.current = true
    let local = getLocalData()
    if (mountedRef.current) {
      setStatus('syncing')
      setError(null)
    }

    try {
      const remote = await api.getSync()
      local = getLocalData()
      const localFingerprint = fingerprintSyncData(local)

      if (!remote.data) {
        const saved = await api.putSync(remote.version, local)
        markSynced(saved, local)
        if (mountedRef.current) setStatus('idle')
        return
      }

      const remoteFingerprint = fingerprintSyncData(normalizeSyncData(remote.data))
      const meta = loadSyncMeta()
      const action = decideSyncAction({
        localFingerprint,
        remoteFingerprint,
        lastFingerprint: meta?.fingerprint ?? null,
      })

      if (action === 'none') {
        markSynced(remote, remote.data)
      } else if (action === 'pull') {
        applyRemoteData(remote.data)
        markSynced(remote, remote.data)
      } else if (action === 'push') {
        const saved = await api.putSync(remote.version, local)
        markSynced(saved, local)
      } else {
        updateConflict({ local, remote })
        if (mountedRef.current) setStatus('conflict')
        return
      }

      if (mountedRef.current) setStatus('idle')
    } catch (caught) {
      if (!mountedRef.current) return

      if (caught instanceof ApiError && caught.status === 401) {
        updateSession(null)
        setSessionHint(false)
        clearSyncMeta()
        updateConflict(null)
        setStatus('error')
        setError('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }

      if (caught instanceof ApiError && caught.status === 409 && caught.current) {
        updateConflict({ local, remote: caught.current })
        setStatus('conflict')
        return
      }

      setStatus('error')
      setError(
        caught instanceof ApiError
          ? caught.message
          : '동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      syncInFlightRef.current = false
    }
  }, [applyRemoteData, getLocalData, markSynced, updateConflict, updateSession])

  const authenticate = useCallback(
    async (mode: 'login' | 'register', email: string, password: string) => {
      if (mountedRef.current) {
        setStatus('authenticating')
        setError(null)
      }

      try {
        const response =
          mode === 'login'
            ? await api.login(email, password)
            : await api.register(email, password)

        updateSession(response.user)
        setSessionHint(true)
        clearSyncMeta()
        autoSyncFingerprintRef.current = null
        updateConflict(null)
        if (mountedRef.current) {
          setLastSyncedAt(null)
          setRemoteVersion(null)
          setStatus('idle')
        }

        await syncNow()
      } catch (caught) {
        if (!mountedRef.current) return
        setStatus('error')
        setError(
          caught instanceof ApiError
            ? caught.message
            : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        )
      }
    },
    [syncNow, updateConflict, updateSession],
  )

  const login = useCallback(
    (email: string, password: string) => authenticate('login', email, password),
    [authenticate],
  )

  const register = useCallback(
    (email: string, password: string) => authenticate('register', email, password),
    [authenticate],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Local sign-out still proceeds if the server is temporarily unavailable.
    }

    updateSession(null)
    setSessionHint(false)
    clearSyncMeta()
    updateConflict(null)
    autoSyncFingerprintRef.current = null
    if (mountedRef.current) {
      setStatus('idle')
      setError(null)
      setLastSyncedAt(null)
      setRemoteVersion(null)
    }
  }, [updateConflict, updateSession])

  const resolveConflict = useCallback(
    async (choice: 'local' | 'server') => {
      const current = conflictRef.current
      if (!current || syncInFlightRef.current) return

      syncInFlightRef.current = true
      if (mountedRef.current) {
        setStatus('syncing')
        setError(null)
      }

      try {
        if (choice === 'server') {
          if (!current.remote.data) {
            throw new Error('서버에 동기화할 데이터가 없습니다.')
          }
          applyRemoteData(current.remote.data)
          markSynced(current.remote, current.remote.data)
        } else {
          const local = getLocalData()
          const saved = await api.putSync(current.remote.version, local)
          markSynced(saved, local)
        }

        updateConflict(null)
        if (mountedRef.current) setStatus('idle')
      } catch (caught) {
        if (!mountedRef.current) return

        if (caught instanceof ApiError && caught.status === 409 && caught.current) {
          updateConflict({ local: getLocalData(), remote: caught.current })
          setStatus('conflict')
          setError('다른 기기에서 데이터가 다시 변경되었습니다. 선택을 다시 확인해 주세요.')
          return
        }

        if (caught instanceof ApiError && caught.status === 401) {
          updateSession(null)
          setSessionHint(false)
          clearSyncMeta()
          updateConflict(null)
          setStatus('error')
          setError('로그인이 만료되었습니다. 다시 로그인해 주세요.')
          return
        }

        setStatus('error')
        setError(
          caught instanceof ApiError
            ? caught.message
            : '동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        )
      } finally {
        syncInFlightRef.current = false
      }
    },
    [applyRemoteData, getLocalData, markSynced, updateConflict, updateSession],
  )

  useEffect(() => {
    mountedRef.current = true
    if (!hasSessionHint()) {
      return () => {
        mountedRef.current = false
      }
    }

    let cancelled = false
    void (async () => {
      try {
        const response = await api.me()
        if (cancelled) return

        updateSession(response.user)
        setSessionHint(true)
        autoSyncFingerprintRef.current = fingerprintSyncData(getLocalData())
        await syncNow()
      } catch (caught) {
        if (cancelled) return

        if (caught instanceof ApiError && caught.status === 401) {
          updateSession(null)
          setSessionHint(false)
          clearSyncMeta()
          return
        }

        setStatus('error')
        setError(
          caught instanceof ApiError
            ? caught.message
            : '동기화 서버에 연결할 수 없습니다.',
        )
      }
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [getLocalData, syncNow, updateSession])

  useEffect(() => {
    if (!session) return

    const fingerprint = fingerprintSyncData(
      toSyncData(favorites, categories, settings),
    )

    if (autoSyncFingerprintRef.current === null) {
      autoSyncFingerprintRef.current = fingerprint
      return
    }

    if (autoSyncFingerprintRef.current === fingerprint) return
    autoSyncFingerprintRef.current = fingerprint
    if (conflictRef.current) return

    const timer = window.setTimeout(() => {
      void syncNow()
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [favorites, categories, settings, session, syncNow])

  useEffect(() => {
    const handleOnline = () => {
      if (sessionRef.current && !conflictRef.current) {
        void syncNow()
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncNow])

  const clearError = useCallback(() => {
    setError(null)
    setStatus((current) => (current === 'error' ? 'idle' : current))
  }, [])

  return {
    session,
    status,
    error,
    conflict,
    lastSyncedAt,
    remoteVersion,
    login,
    register,
    logout,
    syncNow,
    resolveConflict,
    clearError,
  }
}
