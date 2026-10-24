import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, Favorite } from '../types'
import type {
  BookmarkImportItem,
  BookmarkImportOutcome,
  BookmarkImportPreview,
  BookmarkImportRequest,
} from '../lib/bookmarks'
import { parseBookmarksForImport, planBookmarkImport } from '../lib/bookmarks'
import { AlertTriangleIcon, BookmarkIcon, CheckIcon } from './Icons'

interface BookmarkImportPanelProps {
  favorites: Favorite[]
  categories: Category[]
  onImport: (request: BookmarkImportRequest) => BookmarkImportOutcome
}

type BookmarkImportState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; message: string }
  | {
      status: 'preview'
      fileName: string
      preview: BookmarkImportPreview
      selected: Set<string>
      useFolders: boolean
      duplicatePolicy: 'skip' | 'replace'
      submitError: string | null
    }
  | { status: 'done'; message: string }

interface FolderGroup {
  path: string[]
  items: BookmarkImportItem[]
}

function GroupCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  )
}

export function BookmarkImportPanel({
  favorites,
  categories,
  onImport,
}: BookmarkImportPanelProps) {
  const [state, setState] = useState<BookmarkImportState>({ status: 'idle' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const previewState = state.status === 'preview' ? state : null
  const previewItems = previewState?.preview.items ?? null

  const groups = useMemo<FolderGroup[]>(() => {
    if (!previewItems) return []
    const map = new Map<string, FolderGroup>()

    for (const item of previewItems) {
      const key = item.folderPath.join('\u0000')
      const group = map.get(key) ?? { path: item.folderPath, items: [] }
      group.items.push(item)
      map.set(key, group)
    }

    return [...map.values()]
  }, [previewItems])

  const selectedItems = useMemo(
    () =>
      previewState
        ? previewState.preview.items.filter((item) => previewState.selected.has(item.key))
        : [],
    [previewState],
  )

  const planResult = useMemo(() => {
    if (!previewState) return null
    return planBookmarkImport(
      {
        items: selectedItems,
        useFolders: previewState.useFolders,
        duplicatePolicy: previewState.duplicatePolicy,
      },
      favorites,
      categories,
    )
  }, [previewState, selectedItems, favorites, categories])

  const plan = planResult?.ok ? planResult.value : null
  const planError = planResult && !planResult.ok ? planResult.error : null
  const selectedCount = previewState?.selected.size ?? 0
  const effectiveCount = plan ? plan.stats.added + plan.stats.updated : 0
  const allSelected =
    previewState !== null && selectedCount === previewState.preview.items.length

  const reset = () => setState({ status: 'idle' })

  const updatePreview = (patch: {
    selected?: Set<string>
    useFolders?: boolean
    duplicatePolicy?: 'skip' | 'replace'
    submitError?: string | null
  }) => {
    setState((current) =>
      current.status === 'preview'
        ? { ...current, ...patch, submitError: patch.submitError ?? null }
        : current,
    )
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setState({
        status: 'error',
        message: '10MB 이하의 Chrome 북마크 HTML 파일만 가져올 수 있습니다.',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setState({ status: 'reading' })
    try {
      const text = await file.text()
      const result = parseBookmarksForImport(text, favorites)

      if (!result.ok) {
        setState({ status: 'error', message: result.error })
        return
      }

      setState({
        status: 'preview',
        fileName: file.name,
        preview: result.value,
        selected: new Set(result.value.items.map((item) => item.key)),
        useFolders: true,
        duplicatePolicy: 'skip',
        submitError: null,
      })
    } catch {
      setState({
        status: 'error',
        message: '파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleItem = (key: string) => {
    setState((current) => {
      if (current.status !== 'preview') return current
      const next = new Set(current.selected)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...current, selected: next, submitError: null }
    })
  }

  const toggleGroup = (items: BookmarkImportItem[], select: boolean) => {
    setState((current) => {
      if (current.status !== 'preview') return current
      const next = new Set(current.selected)
      for (const item of items) {
        if (select) next.add(item.key)
        else next.delete(item.key)
      }
      return { ...current, selected: next, submitError: null }
    })
  }

  const selectAll = () => {
    if (!previewState) return
    updatePreview({
      selected: new Set(previewState.preview.items.map((item) => item.key)),
    })
  }

  const selectNone = () => {
    updatePreview({ selected: new Set() })
  }

  const importSelected = () => {
    if (!previewState || !plan) return

    const outcome = onImport({
      items: selectedItems,
      useFolders: previewState.useFolders,
      duplicatePolicy: previewState.duplicatePolicy,
    })

    if (!outcome.ok) {
      updatePreview({ submitError: outcome.error })
      return
    }

    const { stats } = outcome
    const importedCount = stats.added + stats.updated
    const parts = [`즐겨찾기 ${importedCount}개`]
    if (stats.added > 0) parts.push(`새로 추가 ${stats.added}개`)
    if (stats.updated > 0) parts.push(`기존 항목 업데이트 ${stats.updated}개`)
    if (stats.categoriesCreated > 0) parts.push(`새 카테고리 ${stats.categoriesCreated}개`)

    const skippedDuplicates = stats.skippedDuplicateExisting + stats.skippedDuplicateFile
    if (skippedDuplicates > 0) parts.push(`중복 건너뜀 ${skippedDuplicates}개`)

    setState({
      status: 'done',
      message: `${previewState.fileName}에서 ${parts.join(', ')}를 가져왔습니다.`,
    })
  }

  const fileButtonLabel =
    state.status === 'reading'
      ? '파일 읽는 중...'
      : state.status === 'preview' || state.status === 'done'
        ? '다른 파일 선택'
        : '북마크 HTML 선택'

  return (
    <section className="data-card data-card--stacked bookmark-import">
      <div className="data-card-heading">
        <span className="data-card-icon" aria-hidden="true">
          <BookmarkIcon size={20} />
        </span>
        <div className="data-card-copy">
          <h3>Chrome 북마크 가져오기</h3>
          <p>
            Chrome에서 내보낸 HTML 파일을 선택하세요. 폴더는 카테고리로 변환되며,
            가져오기 전에 항목을 미리 보고 선택할 수 있습니다.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id="bookmark-file-input"
        type="file"
        accept=".html,.htm,text/html"
        aria-label="Chrome 북마크 HTML 파일 선택"
        className="visually-hidden-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <div className="bookmark-import-toolbar">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={state.status === 'reading'}
        >
          {fileButtonLabel}
        </button>
        {state.status === 'preview' && (
          <button type="button" className="button button--ghost" onClick={reset}>
            취소
          </button>
        )}
      </div>

      {state.status === 'error' && (
        <div className="import-message import-message--error" role="alert">
          <AlertTriangleIcon size={17} />
          <p>{state.message}</p>
        </div>
      )}

      {state.status === 'done' && (
        <div className="import-message import-message--success" role="status">
          <CheckIcon size={17} />
          <p>{state.message}</p>
        </div>
      )}

      {previewState && (
        <div className="bookmark-preview">
          <div className="bookmark-preview-header">
            <p className="import-preview-title" title={previewState.fileName}>
              {previewState.fileName}
            </p>
            <p>
              유효한 북마크 <strong>{previewState.preview.items.length}개</strong>
              {previewState.preview.rejected.length > 0
                ? ` · 건너뜀 ${previewState.preview.rejected.length}개`
                : ''}
            </p>
            {previewState.preview.truncated && (
              <p className="bookmark-note">
                파일이 커서 앞부분 2,000개만 검사했습니다.
              </p>
            )}
          </div>

          <div className="bookmark-stats" role="status" aria-live="polite">
            <span>
              <strong>{selectedCount}</strong>개 선택
            </span>
            {previewState.preview.duplicatesWithExisting > 0 && (
              <span>기존 URL 중복 {previewState.preview.duplicatesWithExisting}개</span>
            )}
            {previewState.preview.duplicatesInFile > 0 && (
              <span>파일 내 중복 {previewState.preview.duplicatesInFile}개</span>
            )}
            {previewState.preview.rejected.length > 0 && (
              <span>잘못된 항목 {previewState.preview.rejected.length}개</span>
            )}
          </div>

          <div className="bookmark-options">
            <label className="bookmark-check-row">
              <input
                type="checkbox"
                checked={previewState.useFolders}
                onChange={(event) =>
                  updatePreview({ useFolders: event.target.checked })
                }
              />
              <span>폴더 이름을 카테고리로 사용</span>
            </label>

            {previewState.preview.duplicatesWithExisting > 0 && (
              <label className="bookmark-select-field">
                <span>기존 URL 중복 처리</span>
                <select
                  value={previewState.duplicatePolicy}
                  onChange={(event) =>
                    updatePreview({
                      duplicatePolicy: event.target.value as 'skip' | 'replace',
                    })
                  }
                >
                  <option value="skip">기존 즐겨찾기 유지 (가져오지 않음)</option>
                  <option value="replace">가져온 항목으로 기존 항목 업데이트</option>
                </select>
              </label>
            )}
          </div>

          {plan && selectedCount > effectiveCount && (
            <p className="bookmark-note">
              선택한 {selectedCount}개 중 {selectedCount - effectiveCount}개는 중복
              처리에 따라 제외됩니다.
            </p>
          )}

          {plan && plan.categoryPlan.length > 0 && (
            <div className="bookmark-category-plan">
              <div className="bookmark-section-heading">
                <p>카테고리</p>
                <span>{plan.categoryPlan.length}개 사용</span>
              </div>
              <ul className="bookmark-category-list">
                {plan.categoryPlan.map((category) => (
                  <li key={category.id}>
                    <span className="bookmark-category-name">{category.name}</span>
                    <span className="bookmark-category-meta">
                      {category.isNew ? '새로 추가' : '기존'} · {category.count}개
                    </span>
                  </li>
                ))}
              </ul>
              {plan.stats.fallbackCount > 0 && (
                <p className="bookmark-note">
                  카테고리 한도(30개) 또는 폴더 이름 문제로 {plan.stats.fallbackCount}개가
                  기타에 배치됩니다.
                </p>
              )}
              {plan.stats.truncatedCategoryNames > 0 && (
                <p className="bookmark-note">일부 폴더 이름이 20자로 줄어듭니다.</p>
              )}
            </div>
          )}

          <div className="bookmark-list-toolbar">
            <span className="bookmark-list-title">가져올 항목</span>
            <div className="bookmark-list-buttons">
              <button
                type="button"
                className="bookmark-link-button"
                onClick={selectAll}
                disabled={allSelected}
              >
                전체 선택
              </button>
              <button
                type="button"
                className="bookmark-link-button"
                onClick={selectNone}
                disabled={selectedCount === 0}
              >
                전체 해제
              </button>
            </div>
            <span className="bookmark-list-count">
              {selectedCount}/{previewState.preview.items.length}
            </span>
          </div>

          <div
            className="bookmark-list"
            role="group"
            aria-label="가져올 북마크 선택"
          >
            {groups.map((group) => {
              const groupSelected = group.items.filter((item) =>
                previewState.selected.has(item.key),
              ).length
              const allGroupSelected = groupSelected === group.items.length
              const someGroupSelected = groupSelected > 0 && !allGroupSelected
              const folderLabel =
                group.path.length > 0 ? group.path.join(' / ') : '폴더 없음'

              return (
                <section className="bookmark-folder" key={group.path.join('\u0000')}>
                  <div className="bookmark-folder-head">
                    <label className="bookmark-folder-label">
                      <GroupCheckbox
                        checked={allGroupSelected}
                        indeterminate={someGroupSelected}
                        label={`${folderLabel} 폴더 전체 선택`}
                        onChange={() => toggleGroup(group.items, !allGroupSelected)}
                      />
                      <span title={folderLabel}>{folderLabel}</span>
                    </label>
                    <span className="bookmark-folder-count">
                      {groupSelected}/{group.items.length}
                    </span>
                  </div>

                  <ul className="bookmark-items">
                    {group.items.map((item) => (
                      <li
                        className={`bookmark-item${item.duplicateOf ? ' is-duplicate' : ''}`}
                        key={item.key}
                      >
                        <label className="bookmark-item-label">
                          <input
                            type="checkbox"
                            checked={previewState.selected.has(item.key)}
                            onChange={() => toggleItem(item.key)}
                          />
                          <span className="bookmark-item-copy">
                            <span className="bookmark-item-title">{item.title}</span>
                            <span className="bookmark-item-url" title={item.url}>
                              {item.url}
                            </span>
                            <span className="bookmark-item-meta">
                              {item.folderName
                                ? `폴더: ${item.folderName}`
                                : '폴더 없음 · 기타'}
                              {item.duplicateOf
                                ? ` · 기존 “${item.duplicateOf.name}”과 중복`
                                : ''}
                              {item.duplicateInFile ? ' · 파일 내 중복' : ''}
                            </span>
                            {item.warning && (
                              <span className="bookmark-item-warning">{item.warning}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>

          {previewState.preview.rejected.length > 0 && (
            <details className="bookmark-issues">
              <summary>
                건너뛴 항목 {previewState.preview.rejected.length}개 보기
              </summary>
              <ul>
                {previewState.preview.rejected.slice(0, 50).map((issue, index) => (
                  <li key={`${issue.url}-${index}`}>
                    <strong>{issue.title || '(제목 없음)'}</strong>
                    {issue.url && <span className="bookmark-issue-url">{issue.url}</span>}
                    <span>{issue.reason}</span>
                  </li>
                ))}
              </ul>
              {previewState.preview.rejected.length > 50 && (
                <p className="bookmark-note">
                  외 {previewState.preview.rejected.length - 50}개는 표시하지 않았습니다.
                </p>
              )}
            </details>
          )}

          {(planError || previewState.submitError) && (
            <div className="import-message import-message--error" role="alert">
              <AlertTriangleIcon size={17} />
              <p>{previewState.submitError ?? planError}</p>
            </div>
          )}

          <div className="bookmark-preview-actions">
            <button type="button" className="button button--ghost" onClick={reset}>
              취소
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={importSelected}
              disabled={!plan || effectiveCount === 0}
            >
              {effectiveCount > 0 ? `${effectiveCount}개 가져오기` : '가져올 항목 없음'}
            </button>
          </div>

          <p className="bookmark-note">
            기존 즐겨찾기 {favorites.length}개와 설정은 유지됩니다. 선택한 항목만
            추가하거나, 선택한 중복 처리 방법에 따라 기존 항목을 업데이트합니다.
          </p>
        </div>
      )}
    </section>
  )
}
