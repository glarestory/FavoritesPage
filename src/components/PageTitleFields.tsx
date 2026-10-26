import { useEffect, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { normalizePageTitle, PAGE_TITLE_MAX_LENGTH } from '../lib/page-titles.mjs'

type TitleKey = 'siteTitle' | 'heroTitle'

interface PageTitleFieldsProps {
  settings: Settings
  onPatchSettings: (patch: Partial<Settings>) => void
}

const FIELDS: Array<{ key: TitleKey; label: string; help: string }> = [
  { key: 'siteTitle', label: '사이트 이름', help: '왼쪽 위 로고 옆과 브라우저 탭에 표시됩니다.' },
  { key: 'heroTitle', label: '메인 제목', help: '검색창 위에 크게 표시됩니다.' },
]

export function PageTitleFields({ settings, onPatchSettings }: PageTitleFieldsProps) {
  const [drafts, setDrafts] = useState<Record<TitleKey, string>>({
    siteTitle: settings.siteTitle,
    heroTitle: settings.heroTitle,
  })

  useEffect(() => {
    setDrafts({ siteTitle: settings.siteTitle, heroTitle: settings.heroTitle })
  }, [settings.siteTitle, settings.heroTitle])

  // Drafts are committed on blur/Enter so typing spaces is not trimmed mid-edit.
  const commit = (key: TitleKey) => {
    const next = normalizePageTitle(drafts[key], DEFAULT_SETTINGS[key])
    setDrafts((current) => ({ ...current, [key]: next }))
    if (next !== settings[key]) onPatchSettings({ [key]: next })
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, key: TitleKey) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(key)
  }

  const isDefault =
    settings.siteTitle === DEFAULT_SETTINGS.siteTitle &&
    settings.heroTitle === DEFAULT_SETTINGS.heroTitle

  return (
    <fieldset className="settings-section">
      <legend>페이지 문구</legend>
      <p className="section-description">
        화면에 표시되는 이름을 바꿉니다. 비워 두면 기본 문구를 사용합니다.
      </p>
      <div className="title-fields">
        {FIELDS.map((field) => (
          <label key={field.key} className="field title-field" htmlFor={`page-${field.key}`}>
            <span className="field-label">{field.label}</span>
            <input
              id={`page-${field.key}`}
              type="text"
              value={drafts[field.key]}
              maxLength={PAGE_TITLE_MAX_LENGTH}
              placeholder={DEFAULT_SETTINGS[field.key]}
              aria-describedby={`page-${field.key}-help`}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onBlur={() => commit(field.key)}
              onKeyDown={(event) => handleKeyDown(event, field.key)}
            />
            <span id={`page-${field.key}-help`} className="field-help">
              {field.help}
            </span>
          </label>
        ))}
      </div>
      {!isDefault && (
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onPatchSettings({
              siteTitle: DEFAULT_SETTINGS.siteTitle,
              heroTitle: DEFAULT_SETTINGS.heroTitle,
            })
          }
        >
          기본 문구로 되돌리기
        </button>
      )}
    </fieldset>
  )
}
