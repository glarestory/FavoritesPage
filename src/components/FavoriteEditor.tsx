import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, Favorite, FavoriteInput } from '../types'
import {
  getHostname,
  isDuplicateUrl,
  validateWebUrl,
} from '../lib/url'
import { Dialog } from './Dialog'
import { FavoriteIcon } from './FavoriteIcon'
import { ChevronDownIcon, LinkIcon, GlobeIcon, TagIcon } from './Icons'

interface FavoriteEditorProps {
  favorite: Favorite | null
  favorites: Favorite[]
  categories: Category[]
  defaultCategoryId: string
  onSave: (input: FavoriteInput) => void
  onClose: () => void
}

interface FormErrors {
  name?: string
  url?: string
  category?: string
  iconUrl?: string
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

  const [name, setName] = useState(favorite?.name ?? '')
  const [url, setUrl] = useState(favorite?.url ?? '')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [iconUrl, setIconUrl] = useState(favorite?.iconUrl ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const iconRef = useRef<HTMLInputElement>(null)

  const isEditing = favorite !== null
  const selectedCategoryId = categories.some(
    (category) => category.id === categoryId,
  )
    ? categoryId
    : categories[0]?.id ?? ''

  const preview = useMemo(() => {
    const validatedUrl = validateWebUrl(url)
    const validatedIcon = iconUrl.trim() ? validateWebUrl(iconUrl, '아이콘 URL') : null
    return {
      favorite: {
        name: name.trim() || '사이트 미리보기',
        url: validatedUrl.ok ? validatedUrl.value : '',
        iconUrl:
          validatedIcon && validatedIcon.ok ? validatedIcon.value : undefined,
      } satisfies Pick<Favorite, 'name' | 'url' | 'iconUrl'>,
      hostname: validatedUrl.ok ? getHostname(validatedUrl.value) : '주소를 입력해 주세요',
    }
  }, [name, url, iconUrl])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: FormErrors = {}
    const trimmedName = name.trim()
    const trimmedIcon = iconUrl.trim()

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

    let normalizedIcon: string | undefined
    if (trimmedIcon) {
      const validatedIcon = validateWebUrl(trimmedIcon, '아이콘 URL')
      if (!validatedIcon.ok) {
        nextErrors.iconUrl = validatedIcon.error
      } else {
        normalizedIcon = validatedIcon.value
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      if (nextErrors.name) nameRef.current?.focus()
      else if (nextErrors.url) urlRef.current?.focus()
      else if (nextErrors.category) categoryRef.current?.focus()
      else iconRef.current?.focus()
      return
    }

    onSave({
      name: trimmedName,
      url: validatedUrl.ok ? validatedUrl.value : url,
      categoryId: selectedCategoryId,
      iconUrl: normalizedIcon,
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
          <button type="submit" form="favorite-editor-form" className="button button--primary">
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

        <div className="field">
          <label htmlFor="favorite-icon-input">
            아이콘 URL <span className="optional-mark">(선택)</span>
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
              spellCheck={false}
              aria-invalid={Boolean(errors.iconUrl)}
              aria-describedby={
                errors.iconUrl ? 'favorite-icon-error favorite-icon-help' : 'favorite-icon-help'
              }
              onChange={(event) => {
                setIconUrl(event.target.value)
                if (errors.iconUrl) {
                  setErrors((current) => ({ ...current, iconUrl: undefined }))
                }
              }}
            />
          </div>
          {errors.iconUrl ? (
            <p id="favorite-icon-error" className="field-error" role="alert">
              {errors.iconUrl}
            </p>
          ) : (
            <p id="favorite-icon-help" className="field-help">
              입력하지 않으면 사이트의 favicon을 자동으로 불러옵니다.
            </p>
          )}
        </div>
      </form>
    </Dialog>
  )
}
