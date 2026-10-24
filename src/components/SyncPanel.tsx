import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, Favorite } from '../types'
import type { SyncController } from '../hooks/useSync'
import {
  AlertTriangleIcon,
  CloudIcon,
  RotateCcwIcon,
} from './Icons'

interface SyncPanelProps {
  sync: SyncController
  favorites: Favorite[]
  categories: Category[]
}

function formatSyncedAt(value: string | null): string {
  if (!value) return '아직 동기화하지 않았습니다.'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '알 수 없음'
  return date.toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function SyncPanel({ sync, favorites, categories }: SyncPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const isAuthenticating = sync.status === 'authenticating'
  const isBusy = isAuthenticating || sync.status === 'syncing'
  const remoteData = sync.conflict?.remote.data
  const localFavorites = sync.conflict?.local.favorites.length ?? favorites.length
  const localCategories = sync.conflict?.local.categories.length ?? categories.length
  const remoteFavorites = remoteData?.favorites.length ?? 0
  const remoteCategories = remoteData?.categories.length ?? 0

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setPassword('')
    sync.clearError()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy) return
    const action = mode === 'login' ? sync.login : sync.register
    void action(email.trim(), password)
  }

  const statusLabel = sync.conflict
    ? '충돌'
    : sync.status === 'syncing'
      ? '동기화 중'
      : sync.status === 'error'
        ? '오류'
        : sync.status === 'authenticating'
          ? '연결 중'
          : '연결됨'

  const statusTone = sync.conflict
    ? 'conflict'
    : sync.status === 'error'
      ? 'error'
      : sync.status === 'syncing' || sync.status === 'authenticating'
        ? 'busy'
        : 'connected'

  return (
    <section className="data-card data-card--stacked sync-card" aria-labelledby="sync-title">
      <div className="data-card-heading">
        <span className="data-card-icon" aria-hidden="true">
          <CloudIcon size={20} />
        </span>
        <div className="data-card-copy">
          <h3 id="sync-title">계정 및 동기화</h3>
          <p>
            로그인하면 즐겨찾기와 설정을 여러 기기에서 동기화합니다. 이 기기의
            localStorage 데이터는 그대로 유지됩니다.
          </p>
        </div>
        {sync.session && (
          <span className={`sync-badge sync-badge--${statusTone}`}>{statusLabel}</span>
        )}
      </div>

      {!sync.session ? (
        <form className="sync-auth-form" onSubmit={handleSubmit}>
          <div className="sync-mode-switch" role="group" aria-label="인증 방식">
            <button
              type="button"
              className={mode === 'login' ? 'is-active' : ''}
              aria-pressed={mode === 'login'}
              onClick={() => switchMode('login')}
              disabled={isBusy}
            >
              로그인
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'is-active' : ''}
              aria-pressed={mode === 'register'}
              onClick={() => switchMode('register')}
              disabled={isBusy}
            >
              회원가입
            </button>
          </div>

          <div className="sync-fields">
            <label className="field">
              <span className="field-label">이메일</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (sync.error) sync.clearError()
                }}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                maxLength={254}
                required
                disabled={isBusy}
              />
            </label>

            <label className="field">
              <span className="field-label">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (sync.error) sync.clearError()
                }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                maxLength={200}
                placeholder="8자 이상"
                required
                disabled={isBusy}
              />
            </label>
          </div>

          <p className="field-help">
            비밀번호는 8자 이상이어야 하며, 서버에는 scrypt 해시로 저장됩니다.
          </p>

          <div className="button-row">
            <button type="submit" className="button button--primary" disabled={isBusy}>
              {isAuthenticating
                ? '처리 중...'
                : mode === 'login'
                  ? '로그인'
                  : '회원가입'}
            </button>
          </div>
        </form>
      ) : (
        <div className="sync-account">
          <div className="sync-account-grid">
            <div>
              <span>로그인 계정</span>
              <strong>{sync.session.email}</strong>
            </div>
            <div>
              <span>마지막 동기화</span>
              <strong>{formatSyncedAt(sync.lastSyncedAt)}</strong>
            </div>
            <div>
              <span>마지막 동기화 버전</span>
              <strong>{sync.remoteVersion ?? '-'}</strong>
            </div>
            <div>
              <span>로컬 데이터</span>
              <strong>
                즐겨찾기 {favorites.length}개 · 카테고리 {categories.length}개
              </strong>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void sync.syncNow()}
              disabled={isBusy || Boolean(sync.conflict)}
            >
              <RotateCcwIcon size={16} />
              {sync.status === 'syncing' ? '동기화 중...' : '지금 동기화'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void sync.logout()}
              disabled={isBusy}
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      {sync.status === 'error' && sync.error && (
        <div className="import-message import-message--error" role="alert">
          <AlertTriangleIcon size={17} />
          <div className="sync-message-body">
            <p>{sync.error}</p>
            <div className="button-row">
              {sync.session ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void sync.syncNow()}
                  disabled={isBusy}
                >
                  다시 시도
                </button>
              ) : (
                <button type="button" className="text-button" onClick={sync.clearError}>
                  오류 닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {sync.conflict && (
        <div className="sync-conflict" role="alert">
          <div className="sync-conflict-heading">
            <AlertTriangleIcon size={18} />
            <div>
              <h4>데이터 충돌</h4>
              <p>
                서버와 이 기기의 데이터가 모두 변경되었습니다. 사용할 데이터를
                선택해 주세요.
              </p>
            </div>
          </div>

          <div className="sync-conflict-compare">
            <div>
              <span>로컬</span>
              <strong>
                즐겨찾기 {localFavorites}개 · 카테고리 {localCategories}개
              </strong>
            </div>
            <div>
              <span>서버</span>
              <strong>
                즐겨찾기 {remoteFavorites}개 · 카테고리 {remoteCategories}개
              </strong>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void sync.resolveConflict('server')}
              disabled={isBusy}
            >
              서버 데이터 사용
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void sync.resolveConflict('local')}
              disabled={isBusy}
            >
              로컬 데이터로 덮어쓰기
            </button>
          </div>

          <p className="field-help">
            서버 데이터를 선택하면 이 기기의 로컬 데이터가 서버 데이터로
            교체됩니다. 로컬 데이터를 선택하면 다른 기기의 최신 변경 내용을
            덮어씁니다.
          </p>
        </div>
      )}

      {sync.status === 'syncing' && !sync.conflict && (
        <p className="sync-progress" role="status">
          동기화 중...
        </p>
      )}
    </section>
  )
}
