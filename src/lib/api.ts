import type { Category, Favorite, Settings } from '../types'

export interface AuthUser {
  id: string
  email: string
  createdAt?: string
}

export interface SyncData {
  schemaVersion?: number
  favorites: Favorite[]
  categories: Category[]
  settings: Settings
}

export interface SyncSnapshot {
  version: number
  updatedAt: string | null
  data: SyncData | null
}

export interface SyncStatusSummary {
  version: number
  updatedAt: string | null
}

export interface AuthResponse {
  user: AuthUser
}

export interface MeResponse extends AuthResponse {
  sync: SyncStatusSummary
}

export class ApiError extends Error {
  readonly status: number
  readonly current?: SyncSnapshot

  constructor(status: number, message: string, current?: SyncSnapshot) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.current = current
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.error === 'string') return body.error
  if (status === 401) return '로그인이 필요합니다.'
  if (status === 409) return '데이터가 충돌했습니다.'
  if (status >= 500) {
    return '동기화 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  }
  return '요청을 처리하지 못했습니다.'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers,
    })
  } catch {
    throw new ApiError(
      0,
      '동기화 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
    )
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const current =
      isRecord(body) && isRecord(body.current)
        ? (body.current as unknown as SyncSnapshot)
        : undefined
    throw new ApiError(response.status, errorMessage(body, response.status), current)
  }

  if (response.status === 204) return undefined as T
  return body as T
}

export const api = {
  register(email: string, password: string) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout() {
    return request<void>('/api/auth/logout', { method: 'POST' })
  },

  me() {
    return request<MeResponse>('/api/auth/me')
  },

  getSync() {
    return request<SyncSnapshot>('/api/sync')
  },

  putSync(baseVersion: number, data: SyncData) {
    return request<SyncSnapshot>('/api/sync', {
      method: 'PUT',
      body: JSON.stringify({ baseVersion, ...data }),
    })
  },
}
