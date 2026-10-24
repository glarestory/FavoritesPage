import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Favorite } from '../types'
import { getAvatarTone, getFaviconSources, getSiteInitial } from '../lib/url'

interface FavoriteIconProps {
  favorite: Pick<Favorite, 'name' | 'url' | 'iconUrl'>
  size?: 'md' | 'sm'
}

type IconStatus = 'loading' | 'loaded' | 'fallback'

export function FavoriteIcon({ favorite, size = 'md' }: FavoriteIconProps) {
  const sources = useMemo(
    () => getFaviconSources({ url: favorite.url, iconUrl: favorite.iconUrl }),
    [favorite.url, favorite.iconUrl],
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const [status, setStatus] = useState<IconStatus>(
    sources.length > 0 ? 'loading' : 'fallback',
  )
  const tone = getAvatarTone(favorite.name || favorite.url || 'site')
  const initial = getSiteInitial(favorite.name)
  const currentSource = sources[sourceIndex]

  useEffect(() => {
    setSourceIndex(0)
    setStatus(sources.length > 0 ? 'loading' : 'fallback')
  }, [sources])

  const style = {
    '--tile-bg': tone.background,
    '--tile-fg': tone.color,
  } as CSSProperties

  return (
    <span
      className={`favorite-icon favorite-icon--${size} ${status === 'loaded' ? 'has-image' : ''}`}
      style={style}
      aria-hidden="true"
    >
      <span className="favorite-icon-letter">{initial}</span>
      {status === 'loading' && <span className="favorite-icon-skeleton" />}
      {currentSource && status !== 'fallback' && (
        <img
          key={currentSource}
          src={currentSource}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={status === 'loaded' ? 'is-loaded' : ''}
          onLoad={() => setStatus('loaded')}
          onError={() => {
            if (sourceIndex + 1 < sources.length) {
              setSourceIndex((index) => index + 1)
              setStatus('loading')
            } else {
              setStatus('fallback')
            }
          }}
        />
      )}
    </span>
  )
}
