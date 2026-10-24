import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, Favorite } from '../types'
import {
  getCategoryCounts,
  getFallbackCategory,
  MAX_CATEGORIES,
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
  validateCategoryName,
} from '../lib/categories'
import { Dialog } from './Dialog'
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from './Icons'

interface CategoryManagerProps {
  categories: Category[]
  favorites: Favorite[]
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onClose: () => void
}

export function CategoryManager({
  categories,
  favorites,
  onAdd,
  onRename,
  onDelete,
  onMove,
  onClose,
}: CategoryManagerProps) {
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const newNameRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => getCategoryCounts(favorites), [favorites])
  const atLimit = categories.length >= MAX_CATEGORIES
  const deleteTarget = deleteId
    ? categories.find((category) => category.id === deleteId) ?? null
    : null
  const deleteFallback = deleteTarget
    ? getFallbackCategory(categories, deleteTarget.id)
    : null
  const deleteCount = deleteTarget ? counts.get(deleteTarget.id) ?? 0 : 0

  useEffect(() => {
    if (!editingId) return
    const frame = window.requestAnimationFrame(() => editInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [editingId])

  const focusEditButton = (id: string) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`category-edit-${id}`)?.focus()
    })
  }

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (atLimit) {
      setAddError(`카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있습니다.`)
      return
    }
    const error = validateCategoryName(newName, categories)
    if (error) {
      setAddError(error)
      newNameRef.current?.focus()
      return
    }

    onAdd(normalizeCategoryName(newName))
    setNewName('')
    setAddError('')
    newNameRef.current?.focus()
  }

  const startEdit = (category: Category) => {
    setDeleteId(null)
    setEditingId(category.id)
    setEditingName(category.name)
    setEditError('')
  }

  const cancelEdit = () => {
    const id = editingId
    setEditingId(null)
    setEditError('')
    if (id) focusEditButton(id)
  }

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId) return
    const error = validateCategoryName(editingName, categories, editingId)
    if (error) {
      setEditError(error)
      editInputRef.current?.focus()
      return
    }

    const id = editingId
    onRename(id, normalizeCategoryName(editingName))
    setEditingId(null)
    setEditError('')
    focusEditButton(id)
  }

  const requestDelete = (id: string) => {
    setEditingId(null)
    setDeleteId(id)
  }

  const cancelDelete = () => {
    const id = deleteId
    setDeleteId(null)
    if (id) {
      window.requestAnimationFrame(() => {
        document.getElementById(`category-delete-${id}`)?.focus()
      })
    }
  }

  const confirmDelete = () => {
    if (!deleteId) return
    onDelete(deleteId)
    setDeleteId(null)
    window.requestAnimationFrame(() => newNameRef.current?.focus())
  }

  return (
    <Dialog
      title="카테고리 관리"
      subtitle="즐겨찾기를 분류하고 탭에 표시할 순서를 정하세요."
      onClose={onClose}
      initialFocusSelector="#category-name-input"
    >
      <div className="category-manager">
        <form className="category-add-form" onSubmit={handleAdd} noValidate>
          <label className="field-label" htmlFor="category-name-input">
            새 카테고리
          </label>
          <div className="category-add-row">
            <input
              id="category-name-input"
              ref={newNameRef}
              type="text"
              value={newName}
              maxLength={MAX_CATEGORY_NAME_LENGTH}
              placeholder="예: 디자인"
              autoComplete="off"
              aria-invalid={Boolean(addError)}
              aria-describedby={addError ? 'category-add-error' : 'category-add-help'}
              onChange={(event) => {
                setNewName(event.target.value)
                if (addError) setAddError('')
              }}
            />
            <button
              type="submit"
              className="button button--primary button--compact"
              disabled={atLimit}
            >
              <PlusIcon size={16} />
              추가
            </button>
          </div>
          {addError ? (
            <p id="category-add-error" className="field-error" role="alert">
              {addError}
            </p>
          ) : (
            <p id="category-add-help" className="field-help">
              {atLimit
                ? `카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있습니다.`
                : `최대 ${MAX_CATEGORY_NAME_LENGTH}자, “전체”는 사용할 수 없습니다.`}
            </p>
          )}
        </form>

        <div className="category-list-head">
          <p>카테고리 {categories.length}개</p>
          <p>위·아래 버튼으로 탭 순서를 바꿀 수 있습니다.</p>
        </div>

        <ul className="category-list">
          {categories.map((category, index) => {
            const count = counts.get(category.id) ?? 0
            const isEditing = editingId === category.id
            const isDeleting = deleteId === category.id
            const isFirst = index === 0
            const isLast = index === categories.length - 1

            return (
              <li
                key={category.id}
                className={[
                  'category-row',
                  isEditing ? 'is-editing' : '',
                  isDeleting ? 'is-deleting' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isEditing ? (
                  <form className="category-edit-form" onSubmit={handleRename} noValidate>
                    <label className="sr-only" htmlFor={`category-edit-input-${category.id}`}>
                      {category.name} 카테고리 이름
                    </label>
                    <input
                      id={`category-edit-input-${category.id}`}
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      maxLength={MAX_CATEGORY_NAME_LENGTH}
                      autoComplete="off"
                      aria-invalid={Boolean(editError)}
                      aria-describedby={
                        editError ? `category-edit-error-${category.id}` : undefined
                      }
                      onChange={(event) => {
                        setEditingName(event.target.value)
                        if (editError) setEditError('')
                      }}
                    />
                    <div className="category-row-actions">
                      <button
                        type="submit"
                        className="button button--primary button--compact"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--compact"
                        onClick={cancelEdit}
                      >
                        취소
                      </button>
                    </div>
                    {editError && (
                      <p
                        id={`category-edit-error-${category.id}`}
                        className="field-error"
                        role="alert"
                      >
                        {editError}
                      </p>
                    )}
                  </form>
                ) : (
                  <>
                    <span className="category-row-icon" aria-hidden="true">
                      <TagIcon size={16} />
                    </span>
                    <div className="category-row-copy">
                      <strong>{category.name}</strong>
                      <small>즐겨찾기 {count}개</small>
                    </div>
                    <div className="category-row-actions">
                      <button
                        type="button"
                        className="category-action"
                        aria-label={`${category.name} 카테고리 위로 이동`}
                        title="위로 이동"
                        disabled={isFirst}
                        onClick={() => onMove(category.id, -1)}
                      >
                        <ChevronUpIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="category-action"
                        aria-label={`${category.name} 카테고리 아래로 이동`}
                        title="아래로 이동"
                        disabled={isLast}
                        onClick={() => onMove(category.id, 1)}
                      >
                        <ChevronDownIcon size={15} />
                      </button>
                      <button
                        id={`category-edit-${category.id}`}
                        type="button"
                        className="category-action"
                        aria-label={`${category.name} 카테고리 이름 수정`}
                        title="이름 수정"
                        onClick={() => startEdit(category)}
                      >
                        <PencilIcon size={15} />
                      </button>
                      <button
                        id={`category-delete-${category.id}`}
                        type="button"
                        className="category-action category-action--danger"
                        aria-label={`${category.name} 카테고리 삭제`}
                        title={
                          categories.length <= 1
                            ? '카테고리가 하나 이상 있어야 합니다.'
                            : '카테고리 삭제'
                        }
                        disabled={categories.length <= 1}
                        onClick={() => requestDelete(category.id)}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </>
                )}

                {isDeleting && deleteTarget && (
                  <div className="category-delete-confirm" role="alert">
                    <AlertTriangleIcon size={18} />
                    <div className="category-delete-copy">
                      <p>
                        <strong>{deleteTarget.name}</strong> 카테고리를 삭제할까요?
                      </p>
                      <p className="category-delete-note">
                        {deleteCount > 0
                          ? `즐겨찾기 ${deleteCount}개는 ${
                              deleteFallback?.name ?? '다른'
                            } 카테고리로 이동합니다.`
                          : '이 카테고리에 즐겨찾기가 없습니다.'}
                      </p>
                    </div>
                    <div className="button-row category-delete-actions">
                      <button
                        type="button"
                        className="button button--ghost button--compact"
                        autoFocus
                        onClick={cancelDelete}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="button button--danger button--compact"
                        onClick={confirmDelete}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <p className="category-manager-note">
          카테고리와 표시 순서는 이 브라우저에 자동으로 저장됩니다.
        </p>
      </div>
    </Dialog>
  )
}
