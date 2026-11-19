import { useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Category, Favorite, FavoriteInput } from '../types'
import {
  FAVORITE_ICON_ACCEPT,
  isLocalIconDataUrl,
  normalizeIconEmoji,
  PRESET_ICON_EMOJIS,
} from '../lib/favorite-icon.mjs'
import { prepareLocalFavoriteIcon } from '../lib/local-image'
import {
  getHostname,
  isDuplicateUrl,
  validateWebUrl,
} from '../lib/url'
import { Dialog } from './Dialog'
import { FavoriteIcon } from './FavoriteIcon'
import {
  ChevronDownIcon,
  GlobeIcon,
  ImageIcon,
  LinkIcon,
  SmileIcon,
  TagIcon,
  UploadIcon,
} from './Icons'

interface FavoriteEditorProps {
  favorite: Favorite | null
  favorites: Favorite[]
  categories: Category[]
  defaultCategoryId: string
  onSave: (input: FavoriteInput) => void
  onClose: () => void
}

type IconMode = 'auto' | 'emoji' | 'local' | 'url'

interface FormErrors {
  name?: string
  url?: string
  category?: string
  icon?: string
}

const ICON_MODE_OPTIONS: Array<{ id: IconMode; label: string; icon: ReactNode }> = [
  { id: 'auto', label: '자동', icon: <GlobeIcon size={14} /> },
  { id: 'emoji', label: '이모지', icon: <SmileIcon size={14} /> },
  { id: 'local', label: '이미지 파일', icon: <ImageIcon size={14} /> },
  { id: 'url', label: 'URL', icon: <LinkIcon size={14} /> },
]

function detectInitialIconMode(favorite: Favorite | null): IconMode {
  if (!favorite) return 'auto'
  if (normalizeIconEmoji(favorite.iconEmoji)) return 'emoji'
  if (favorite.iconUrl && isLocalIconDataUrl(favorite.iconUrl)) return 'local'
  if (favorite.iconUrl) return 'url'
  return 'auto'
}

export function FavoriteEditor({
  favorite,
  favorites,
  categories,
  defaultCategoryId,
  onSave,
  onClose,
}: FavoriteEditorProps) {
  const initialCategoryId =
    favorite?.categoryId &&
    categories.some((category) => category.id === favorite.categoryId)
      ? favorite.categoryId
      : categories.some((category) => category.id === defaultCategoryId)
        ? defaultCategoryId
        : categories[0]?.id ?? ''

  const initialMode = detectInitialIconMode(favorite)

  const [name, setName] = useState(favorite?.name ?? '')
  const [url, setUrl] = useState(favorite?.url ?? '')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [iconMode, setIconMode] = useState<IconMode>(initialMode)
  const [iconEmoji, setIconEmoji] = useState(
    initialMode === 'emoji' ? favorite?.iconEmoji ?? '' : '',
  )
  const [localIconDataUrl, setLocalIconDataUrl] = useState(
    initialMode === 'local' ? favorite?.iconUrl ?? '' : '',
  )
  const [localIconName, setLocalIconName] = useState(
    initialMode === 'local' ? '저장된 로컬 아이콘' : '',
  )
  const [iconUrl, setIconUrl] = useState(
    initialMode === 'url' ? favorite?.iconUrl ?? '' : '',
  )
  const [processingIcon, setProcessingIcon] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const iconRef = useRef<HTMLInputElement>(null)
  const iconEmojiRef = useRef<HTMLInputElement>(null)
  const localIconInputRef = useRef<HTMLInputElement>(null)

  const isEditing = favorite !== null
  const selectedCategoryId = categories.some(
    (category) => category.id === categoryId,
  )
    ? categoryId
    : categories[0]?.id ?? ''

  const preview = useMemo(() => {
    const validatedUrl = validateWebUrl(url)
    let previewIconUrl: string | undefined
    let previewIconEmoji: string | undefined

    if (iconMode === 'emoji') {
      previewIconEmoji = normalizeIconEmoji(iconEmoji)
    } else if (iconMode === 'local') {
      previewIconUrl = localIconDataUrl || undefined
    } else if (iconMode === 'url' && iconUrl.trim()) {
      const validatedIcon = validateWebUrl(iconUrl, '아이콘 URL')
      if (validatedIcon.ok) previewIconUrl = validatedIcon.value
    }

    return {
      favorite: {
        name: name.trim() || '사이트 미리보기',
        url: validatedUrl.ok ? validatedUrl.value : '',
        iconUrl: previewIconUrl,
        iconEmoji: previewIconEmoji,
      } satisfies Pick<Favorite, 'name' | 'url' | 'iconUrl' | 'iconEmoji'>,
      hostname: validatedUrl.ok ? getHostname(validatedUrl.value) : '주소를 입력해 주세요',
    }
  }, [name, url, iconMode, iconEmoji, localIconDataUrl, iconUrl])

  const handleSelectIconMode = (mode: IconMode) => {
    setIconMode(mode)
    if (errors.icon) setErrors((current) => ({ ...current, icon: undefined }))
  }

  const handleLocalIconChange = async (file: File | undefined) => {
    if (!file) return
    setProcessingIcon(true)
    setErrors((current) => ({ ...current, icon: undefined }))

    try {
      const result = await prepareLocalFavoriteIcon(file)
      if (!result.ok) {
        setErrors((current) => ({ ...current, icon: result.error }))
        return
      }
      setLocalIconDataUrl(result.dataUrl)
      setLocalIconName(result.fileName)
    } finally {
      setProcessingIcon(false)
      if (localIconInputRef.current) localIconInputRef.current.value = ''
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (processingIcon) return

    const nextErrors: FormErrors = {}
    const trimmedName = name.trim()

    if (!trimmedName) {
      nextErrors.name = '사이트 이름을 입력해 주세요.'
    }

    const validatedUrl = validateWebUrl(url)
    if (!validatedUrl.ok) {
      nextErrors.url = validatedUrl.error
    } else if (isDuplicateUrl(validatedUrl.value, favorites, favorite?.id)) {
      nextErrors.url = '이미 등록된 URL입니다. 다른 주소를 입력해 주세요.'
    }

    if (!selectedCategoryId) {
      nextErrors.category = '카테고리를 선택해 주세요.'
    }

    let normalizedIconUrl: string | undefined
    let normalizedIconEmoji: string | undefined

    if (iconMode === 'emoji') {
      const normalized = normalizeIconEmoji(iconEmoji)
      if (!normalized) {
        nextErrors.icon = '표시할 이모지를 선택하거나 입력해 주세요.'
      } else {
        normalizedIconEmoji = normalized
      }
    } else if (iconMode === 'local') {
      if (!localIconDataUrl || !isLocalIconDataUrl(localIconDataUrl)) {
        nextErrors.icon = '내 기기에서 아이콘 이미지 파일을 선택해 주세요.'
      } else {
        normalizedIconUrl = localIconDataUrl
      }
    } else if (iconMode === 'url') {
      const trimmedIcon = iconUrl.trim()
      if (trimmedIcon) {
        const validatedIcon = validateWebUrl(trimmedIcon, '아이콘 URL')
        if (!validatedIcon.ok) {
          nextErrors.icon = validatedIcon.error
        } else {
          normalizedIconUrl = validatedIcon.value
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.name) nameRef.current?.focus()
      else if (nextErrors.url) urlRef.current?.focus()
      else if (nextErrors.category) categoryRef.current?.focus()
      else if (iconMode === 'emoji') iconEmojiRef.current?.focus()
      else if (iconMode === 'url') iconRef.current?.focus()
      return
    }

    onSave({
      name: trimmedName,
      url: validatedUrl.ok ? validatedUrl.value : url,
      categoryId: selectedCategoryId,
      iconUrl: normalizedIconUrl,
      iconEmoji: normalizedIconEmoji,
    })
  }

  return (
    <Dialog
      title={isEditing ? '즐겨찾기 수정' : '즐겨찾기 추가'}
      subtitle={
        isEditing
          ? '사이트 정보를 변경하면 바로 적용됩니다.'
          : '자주 찾는 사이트를 등록해 보세요.'
      }
      onClose={onClose}
      initialFocusSelector="#favorite-name-input"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            form="favorite-editor-form"
            className="button button--primary"
            disabled={processingIcon}
          >
            {isEditing ? '저장' : '추가'}
          </button>
        </>
      }
    >
      <form
        id="favorite-editor-form"
        className="favorite-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="favorite-preview" aria-label="아이콘 미리보기">
          <FavoriteIcon favorite={preview.favorite} />
          <div className="favorite-preview-text">
            <p className="favorite-preview-name">{preview.favorite.name}</p>
            <p className="favorite-preview-host">{preview.hostname}</p>
          </div>
          <span className="preview-badge">미리보기</span>
        </div>

        <div className="field">
          <label htmlFor="favorite-name-input">
            사이트 이름 <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="favorite-name-input"
            ref={nameRef}
            type="text"
            value={name}
            maxLength={60}
            placeholder="예: GitHub"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'favorite-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              if (errors.name) setErrors((current) => ({ ...current, name: undefined }))
            }}
          />
          {errors.name && (
            <p id="favorite-name-error" className="field-error" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="favorite-url-input">
            사이트 URL <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <div className="input-with-icon">
            <LinkIcon size={17} aria-hidden="true" />
            <input
              id="favorite-url-input"
              ref={urlRef}
              type="text"
              value={url}
              placeholder="https://example.com"
              inputMode="url"
              autoComplete="url"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.url)}
              aria-describedby={
                errors.url ? 'favorite-url-error favorite-url-help' : 'favorite-url-help'
              }
              onChange={(event) => {
                setUrl(event.target.value)
                if (errors.url) setErrors((current) => ({ ...current, url: undefined }))
              }}
            />
          </div>
          {errors.url ? (
            <p id="favorite-url-error" className="field-error" role="alert">
              {errors.url}
            </p>
          ) : (
            <p id="favorite-url-help" className="field-help">
              https://를 생략하면 자동으로 붙습니다.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="favorite-category-input">
            카테고리 <span className="required-mark" aria-hidden="true">*</span>
          </label>
          <div className="select-with-icon">
            <TagIcon size={17} className="select-leading-icon" aria-hidden="true" />
            <select
              id="favorite-category-input"
              ref={categoryRef}
              value={selectedCategoryId}
              aria-invalid={Boolean(errors.category)}
              aria-describedby={
                errors.category
                  ? 'favorite-category-error'
                  : 'favorite-category-help'
              }
              onChange={(event) => {
                setCategoryId(event.target.value)
                if (errors.category) {
                  setErrors((current) => ({ ...current, category: undefined }))
                }
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={16} className="select-chevron" aria-hidden="true" />
          </div>
          {errors.category ? (
            <p id="favorite-category-error" className="field-error" role="alert">
              {errors.category}
            </p>
          ) : (
            <p id="favorite-category-help" className="field-help">
              상단 카테고리 탭에서 이 사이트를 표시할 위치를 선택하세요.
            </p>
          )}
        </div>

        <fieldset className="field icon-mode-fieldset">
          <legend className="field-label">
            아이콘 <span className="optional-mark">(선택)</span>
          </legend>
          <div className="icon-mode-grid">
            {ICON_MODE_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`icon-mode-option ${
                  iconMode === option.id ? 'is-selected' : ''
                }`}
              >
                <input
                  className="choice-input"
                  type="radio"
                  name="favorite-icon-mode"
                  value={option.id}
                  checked={iconMode === option.id}
                  onChange={() => handleSelectIconMode(option.id)}
                />
                {option.icon}
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          {iconMode === 'auto' && (
            <p className="field-help">
              사이트의 favicon을 자동으로 불러오며, 아이콘이 없으면 이름 기반 모노그램으로
              표시합니다.
            </p>
          )}

          {iconMode === 'emoji' && (
            <div className="icon-picker-panel">
              <div className="emoji-preset-grid" role="group" aria-label="추천 이모지">
                {PRESET_ICON_EMOJIS.map((preset) => {
                  const isSelected = normalizeIconEmoji(iconEmoji) === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`emoji-preset-button ${isSelected ? 'is-selected' : ''}`}
                      aria-pressed={isSelected}
                      aria-label={`이모지 ${preset} 선택`}
                      onClick={() => {
                        setIconEmoji(preset)
                        if (errors.icon) {
                          setErrors((current) => ({ ...current, icon: undefined }))
                        }
                      }}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
              <div className="emoji-custom-row">
                <label className="sr-only" htmlFor="favorite-icon-emoji-input">
                  직접 이모지 입력
                </label>
                <input
                  id="favorite-icon-emoji-input"
                  ref={iconEmojiRef}
                  type="text"
                  value={iconEmoji}
                  placeholder="직접 입력 (예: 🔥, 📌)"
                  autoComplete="off"
                  aria-invalid={Boolean(errors.icon)}
                  aria-describedby={errors.icon ? 'favorite-icon-error' : 'favorite-emoji-help'}
                  onChange={(event) => {
                    setIconEmoji(event.target.value)
                    if (errors.icon) {
                      setErrors((current) => ({ ...current, icon: undefined }))
                    }
                  }}
                />
                {iconEmoji && (
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => setIconEmoji('')}
                  >
                    지우기
                  </button>
                )}
              </div>
              <p id="favorite-emoji-help" className="field-help">
                추천 이모지를 누르거나 원하는 이모지 1개를 직접 입력해 주세요.
              </p>
            </div>
          )}

          {iconMode === 'local' && (
            <div className="icon-picker-panel">
              <input
                ref={localIconInputRef}
                id="favorite-icon-file-input"
                type="file"
                accept={FAVORITE_ICON_ACCEPT}
                aria-label="로컬 아이콘 이미지 선택"
                className="visually-hidden-input"
                onChange={(event) => void handleLocalIconChange(event.target.files?.[0])}
              />
              <div className="local-icon-row">
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => localIconInputRef.current?.click()}
                  disabled={processingIcon}
                >
                  <UploadIcon size={15} />
                  {processingIcon
                    ? '처리 중...'
                    : localIconDataUrl
                      ? '다른 이미지 선택'
                      : '이미지 파일 선택'}
                </button>
                {localIconDataUrl && (
                  <>
                    <span className="local-icon-filename" title={localIconName}>
                      {localIconName}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setLocalIconDataUrl('')
                        setLocalIconName('')
                      }}
                    >
                      제거
                    </button>
                  </>
                )}
              </div>
              <p className="field-help">
                JPG, PNG, WebP, GIF, AVIF · 최대 5MB (128×128 이하로 자동 최적화)
              </p>
            </div>
          )}

          {iconMode === 'url' && (
            <div className="icon-picker-panel">
              <label className="sr-only" htmlFor="favorite-icon-input">
                아이콘 URL
              </label>
              <div className="input-with-icon">
                <GlobeIcon size={17} aria-hidden="true" />
                <input
                  id="favorite-icon-input"
                  ref={iconRef}
                  type="text"
                  value={iconUrl}
                  placeholder="https://example.com/icon.png"
                  inputMode="url"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.icon)}
                  aria-describedby={
                    errors.icon ? 'favorite-icon-error favorite-icon-help' : 'favorite-icon-help'
                  }
                  onChange={(event) => {
                    setIconUrl(event.target.value)
                    if (errors.icon) {
                      setErrors((current) => ({ ...current, icon: undefined }))
                    }
                  }}
                />
              </div>
              <p id="favorite-icon-help" className="field-help">
                외부 이미지 주소를 직접 지정할 수 있습니다.
              </p>
            </div>
          )}

          {errors.icon && (
            <p id="favorite-icon-error" className="field-error" role="alert">
              {errors.icon}
            </p>
          )}
        </fieldset>
      </form>
    </Dialog>
  )
}
