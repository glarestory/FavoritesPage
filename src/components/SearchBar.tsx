import { useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { SearchEngineId } from '../types'
import { buildSearchUrl, getSearchEngine } from '../lib/search'
import { SearchIcon, XIcon } from './Icons'

interface SearchBarProps {
  engine: SearchEngineId
  openInNewTab: boolean
  inputRef: RefObject<HTMLInputElement | null>
}

export function SearchBar({ engine, openInNewTab, inputRef }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const searchEngine = getSearchEngine(engine)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const url = buildSearchUrl(engine, query)
    if (!url) {
      inputRef.current?.focus()
      return
    }

    if (openInNewTab) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } else {
      window.location.assign(url)
    }
  }

  return (
    <form
      className="search-bar"
      role="search"
      aria-label={`${searchEngine.name} 웹 검색`}
      onSubmit={handleSubmit}
    >
      <button type="submit" className="search-submit" aria-label="검색 실행">
        <SearchIcon size={21} />
      </button>
      <label className="sr-only" htmlFor="web-search-input">
        웹 검색어
      </label>
      <input
        id="web-search-input"
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder="검색어를 입력하세요..."
        value={query}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.preventDefault()
            setQuery('')
          }
        }}
      />
      {query ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          aria-label="검색어 지우기"
        >
          <XIcon size={18} />
        </button>
      ) : (
        <kbd className="search-shortcut" aria-hidden="true">
          Ctrl K
        </kbd>
      )}
      <span className="sr-only" aria-live="polite">
        검색 엔진: {searchEngine.name}
      </span>
    </form>
  )
}
