import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, SyntheticEvent } from 'react'
import type { Favorite } from '../types'
import {
  buildFaviconCandidates,
  getSiteMonogram,
  isLikelyPlaceholderIcon,
  normalizeIconEmoji,
} from '../lib/favorite-icon.mjs'
import { getAvatarTone } from '../lib/url'

interface FavoriteIconProps {
  favorite: Pick<Favorite, 'name' | 'url' | 'iconUrl' | 'iconEmoji'>
  size?: 'md' | 'sm'
}

type IconStatus = 'loading' | 'loaded' | 'fallback'

export function FavoriteIcon({ favorite, size = 'md' }: FavoriteIconProps) {
  const emoji = normalizeIconEmoji(favorite.iconEmoji)
  const sources = useMemo(
    () =>
      emoji
        ? []
        : buildFaviconCandidates({ url: favorite.url, iconUrl: favorite.iconUrl }),
    [emoji, favorite.url, favorite.iconUrl],
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const [status, setStatus] = useState<IconStatus>(
    sources.length > 0 ? 'loading' : 'fallback',
  )
  const tone = getAvatarTone(favorite.name || favorite.url || 'site')
  const monogram = getSiteMonogram(favorite.name, favorite.url)
  const currentSource = sources[sourceIndex]

  useEffect(() => {
    setSourceIndex(0)
    setStatus(sources.length > 0 ? 'loading' : 'fallback')
  }, [sources])

  const advanceToNextSource = () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((index) => index + 1)
      setStatus('loading')
    } else {
      setStatus('fallback')
    }
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!currentSource) return
    const { naturalWidth, naturalHeight } = event.currentTarget
    // Google S2 기본 회색 지구본(16x16) 등 플레이스홀더 이미지는 건너뛰고 다음 후보로 폴백합니다.
    if (isLikelyPlaceholderIcon(currentSource.kind, naturalWidth, naturalHeight)) {
      advanceToNextSource()
      return
    }
    setStatus('loaded')
  }

  const style = {
    '--tile-bg': tone.gradient,
    '--tile-fg': tone.color,
    '--tile-border': tone.border,
  } as CSSProperties

  return (
    <span
      className={[
        'favorite-icon',
        `favorite-icon--${size}`,
        status === 'loaded' ? 'has-image' : '',
        emoji ? 'has-emoji' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
      {emoji ? (
        <span className="favorite-icon-emoji">{emoji}</span>
      ) : (
        <span
          className={`favorite-icon-letter ${monogram.length >= 2 ? 'is-monogram' : ''}`}
        >
          {monogram}
        </span>
      )}
      {!emoji && status === 'loading' && <span className="favorite-icon-skeleton" />}
      {!emoji && currentSource && status !== 'fallback' && (
        <img
          key={currentSource.url}
          src={currentSource.url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={status === 'loaded' ? 'is-loaded' : ''}
          onLoad={handleImageLoad}
          onError={advanceToNextSource}
        />
      )}
    </span>
  )
}
