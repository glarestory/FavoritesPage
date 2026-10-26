import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Category,
  Favorite,
  FavoriteInput,
  Settings,
  SettingsTab,
  ToastMessage,
} from './types'
import type { ImportedData } from './lib/backup'
import type { BookmarkImportOutcome, BookmarkImportRequest } from './lib/bookmarks'
import { downloadBackup } from './lib/backup'
import { planBookmarkImport } from './lib/bookmarks'
import {
  ALL_CATEGORY_ID,
  createCategory,
  createDefaultCategories,
  getFallbackCategory,
  getFallbackCategoryId,
  MAX_CATEGORIES,
  normalizeCategoryName,
  validateCategoryName,
} from './lib/categories'
import { createDefaultSettings, createStarterFavorites } from './lib/defaults'
import { createId } from './lib/id'
import { resolveBackground } from './lib/background'
import {
  loadCategories,
  loadFavorites,
  loadSettings,
  saveCategories,
  saveFavorites,
  saveSettings,
} from './lib/storage'
import { moveItemToTarget } from './lib/reorder.mjs'
import { isDuplicateUrl, validateWebUrl } from './lib/url'
import { Header } from './components/Header'
import { SearchBar } from './components/SearchBar'
import { FavoritesGrid } from './components/FavoritesGrid'
import { FavoriteEditor } from './components/FavoriteEditor'
import { CategoryManager } from './components/CategoryManager'
import { SettingsPanel } from './components/SettingsPanel'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ToastStack } from './components/Toast'

interface InitialState {
  favorites: Favorite[]
  categories: Category[]
  settings: Settings
  errors: string[]
}

type OverlayState =
  | { kind: 'editor'; favorite: Favorite | null }
  | { kind: 'delete'; favorite: Favorite }
  | { kind: 'categories' }
  | { kind: 'settings'; tab: SettingsTab }
  | null

function loadInitialState(): InitialState {
  const categoriesResult = loadCategories()
  const favoritesResult = loadFavorites(categoriesResult.value)
  const settingsResult = loadSettings()
  return {
    categories: categoriesResult.value,
    favorites: favoritesResult.value,
    settings: settingsResult.value,
    errors: [
      categoriesResult.error,
      favoritesResult.error,
      settingsResult.error,
    ].filter((error): error is string => Boolean(error)),
  }
}

export default function App() {
  const [initial] = useState<InitialState>(() => loadInitialState())
  const [favorites, setFavorites] = useState<Favorite[]>(initial.favorites)
  const [categories, setCategories] = useState<Category[]>(initial.categories)
  const [settings, setSettings] = useState<Settings>(initial.settings)
  const [activeCategoryId, setActiveCategoryId] = useState(ALL_CATEGORY_ID)
  const [filter, setFilter] = useState('')
  const [arranging, setArranging] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)
  const initialErrorsShown = useRef(false)
  const favoritesSaveError = useRef<string | null>(null)
  const categoriesSaveError = useRef<string | null>(null)
  const settingsSaveError = useRef<string | null>(null)

  const pushToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'success') => {
      toastIdRef.current += 1
      const toast: ToastMessage = { id: toastIdRef.current, text, tone }
      setToasts((current) => [...current.slice(-2), toast])
    },
    [],
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    if (initialErrorsShown.current) return
    initialErrorsShown.current = true
    for (const error of initial.errors) pushToast(error, 'error')
  }, [initial.errors, pushToast])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.style.colorScheme = settings.theme
    document.body.style.backgroundColor = settings.theme === 'dark' ? '#0b111b' : '#eef3fb'
  }, [settings.theme])

  useEffect(() => {
    document.title = settings.siteTitle
  }, [settings.siteTitle])

  useEffect(() => {
    const error = saveFavorites(favorites)
    if (error) {
      if (favoritesSaveError.current !== error) {
        favoritesSaveError.current = error
        pushToast(error, 'error')
      }
    } else {
      favoritesSaveError.current = null
    }
  }, [favorites, pushToast])

  useEffect(() => {
    const error = saveCategories(categories)
    if (error) {
      if (categoriesSaveError.current !== error) {
        categoriesSaveError.current = error
        pushToast(error, 'error')
      }
    } else {
      categoriesSaveError.current = null
    }
  }, [categories, pushToast])

  useEffect(() => {
    const error = saveSettings(settings)
    if (error) {
      if (settingsSaveError.current !== error) {
        settingsSaveError.current = error
        pushToast(error, 'error')
      }
    } else {
      settingsSaveError.current = null
    }
  }, [settings, pushToast])

  useEffect(() => {
    if (activeCategoryId === ALL_CATEGORY_ID) return
    if (!categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(ALL_CATEGORY_ID)
    }
  }, [categories, activeCategoryId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        if (overlay) return
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [overlay])

  const categoryFavorites = useMemo(
    () =>
      activeCategoryId === ALL_CATEGORY_ID
        ? favorites
        : favorites.filter((favorite) => favorite.categoryId === activeCategoryId),
    [favorites, activeCategoryId],
  )

  const filteredFavorites = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return categoryFavorites
    return categoryFavorites.filter(
      (favorite) =>
        favorite.name.toLowerCase().includes(query) ||
        favorite.url.toLowerCase().includes(query),
    )
  }, [categoryFavorites, filter])

  const resolvedBackground = useMemo(
    () => resolveBackground(settings.background, settings.theme),
    [settings.background, settings.theme],
  )

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const openAdd = () => setOverlay({ kind: 'editor', favorite: null })
  const openSettings = (tab: SettingsTab = 'general') =>
    setOverlay({ kind: 'settings', tab })

  const defaultCategoryId =
    activeCategoryId === ALL_CATEGORY_ID
      ? getFallbackCategoryId(categories)
      : activeCategoryId

  const handleSaveFavorite = (input: FavoriteInput) => {
    const validated = validateWebUrl(input.url)
    if (!validated.ok) {
      pushToast(validated.error, 'error')
      return
    }

    const editingFavorite = overlay?.kind === 'editor' ? overlay.favorite : null
    if (isDuplicateUrl(validated.value, favorites, editingFavorite?.id)) {
      pushToast('이미 등록된 URL입니다. 다른 주소를 입력해 주세요.', 'error')
      return
    }

    const categoryId = categories.some((category) => category.id === input.categoryId)
      ? input.categoryId
      : getFallbackCategoryId(categories)

    const normalizedInput: FavoriteInput = {
      name: input.name.trim(),
      url: validated.value,
      iconUrl: input.iconUrl,
      categoryId,
    }

    if (editingFavorite) {
      setFavorites((current) =>
        current.map((favorite) =>
          favorite.id === editingFavorite.id
            ? { ...favorite, ...normalizedInput, iconUrl: normalizedInput.iconUrl }
            : favorite,
        ),
      )
      pushToast('즐겨찾기를 수정했습니다.')
    } else {
      const newFavorite: Favorite = {
        id: createId(),
        createdAt: Date.now(),
        ...normalizedInput,
      }
      setFavorites((current) => [...current, newFavorite])
      pushToast('즐겨찾기를 추가했습니다.')
    }

    if (activeCategoryId !== ALL_CATEGORY_ID && activeCategoryId !== categoryId) {
      setActiveCategoryId(categoryId)
    }
    setOverlay(null)
  }

  const handleReorder = (sourceId: string, targetId: string) => {
    setFavorites((current) => moveItemToTarget(current, sourceId, targetId))
  }

  const handleMoveFavorite = (favoriteId: string, direction: -1 | 1) => {
    setFavorites((current) => {
      const source = current.find((favorite) => favorite.id === favoriteId)
      if (!source) return current
      const pool =
        activeCategoryId === ALL_CATEGORY_ID
          ? current
          : current.filter((favorite) => favorite.categoryId === activeCategoryId)
      const index = pool.findIndex((favorite) => favorite.id === favoriteId)
      const target = index >= 0 ? pool[index + direction] : undefined
      if (!target) return current
      return moveItemToTarget(current, favoriteId, target.id)
    })
  }

  const handleMoveToCategory = (favoriteId: string, categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId)
    const favorite = favorites.find((item) => item.id === favoriteId)
    if (!category || !favorite || favorite.categoryId === categoryId) return
    setFavorites((current) =>
      current.map((item) =>
        item.id === favoriteId ? { ...item, categoryId } : item,
      ),
    )
    pushToast(`${favorite.name} 사이트를 ${category.name} 카테고리로 이동했습니다.`)
  }

  const handleAddCategory = (name: string) => {
    if (categories.length >= MAX_CATEGORIES) return
    if (validateCategoryName(name, categories)) return
    const category = createCategory(name)
    setCategories((current) => [...current, category])
    pushToast(`“${category.name}” 카테고리를 추가했습니다.`)
  }

  const handleRenameCategory = (id: string, name: string) => {
    if (validateCategoryName(name, categories, id)) return
    const normalized = normalizeCategoryName(name)
    setCategories((current) =>
      current.map((category) =>
        category.id === id ? { ...category, name: normalized } : category,
      ),
    )
    pushToast('카테고리 이름을 수정했습니다.')
  }

  const handleDeleteCategory = (id: string) => {
    const target = categories.find((category) => category.id === id)
    const fallback = getFallbackCategory(categories, id)
    if (!target || !fallback || categories.length <= 1) return

    const count = favorites.filter((favorite) => favorite.categoryId === id).length
    setCategories((current) => current.filter((category) => category.id !== id))
    setFavorites((current) =>
      current.map((favorite) =>
        favorite.categoryId === id
          ? { ...favorite, categoryId: fallback.id }
          : favorite,
      ),
    )
    if (activeCategoryId === id) setActiveCategoryId(fallback.id)
    pushToast(
      count > 0
        ? `카테고리를 삭제하고 즐겨찾기 ${count}개를 ${fallback.name} 카테고리로 이동했습니다.`
        : '카테고리를 삭제했습니다.',
    )
  }

  const handleMoveCategory = (id: string, direction: -1 | 1) => {
    setCategories((current) => {
      const from = current.findIndex((category) => category.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      if (!moved) return current
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleReorderCategory = (sourceId: string, targetId: string) => {
    setCategories((current) => moveItemToTarget(current, sourceId, targetId))
  }

  const confirmDelete = () => {
    if (overlay?.kind !== 'delete') return
    const target = overlay.favorite
    setFavorites((current) => current.filter((favorite) => favorite.id !== target.id))
    setOverlay(null)
    pushToast('즐겨찾기를 삭제했습니다.')
    window.requestAnimationFrame(() => {
      document.getElementById('favorite-filter')?.focus()
    })
  }

  const handleRestoreDefaults = () => {
    setFavorites(createStarterFavorites())
    setCategories(createDefaultCategories())
    setActiveCategoryId(ALL_CATEGORY_ID)
    pushToast('기본 즐겨찾기와 카테고리를 불러왔습니다.')
  }

  const handleExport = () => {
    try {
      const filename = downloadBackup(favorites, categories, settings)
      pushToast(`${filename} 파일을 내보냈습니다.`)
    } catch {
      pushToast('백업 파일을 만들지 못했습니다. 다시 시도해 주세요.', 'error')
    }
  }

  const handleImport = (data: ImportedData) => {
    const nextCategories = data.categories ?? categories
    const categoryIds = new Set(nextCategories.map((category) => category.id))
    const fallbackCategoryId = getFallbackCategoryId(nextCategories)
    const nextFavorites = data.favorites.map((favorite) =>
      categoryIds.has(favorite.categoryId)
        ? favorite
        : { ...favorite, categoryId: fallbackCategoryId },
    )

    setCategories(nextCategories)
    setFavorites(nextFavorites)
    if (data.settings) setSettings(data.settings)
    setFilter('')
    setActiveCategoryId(ALL_CATEGORY_ID)
    setArranging(false)

    const parts = [`즐겨찾기 ${nextFavorites.length}개`]
    if (data.categories) parts.push(`카테고리 ${nextCategories.length}개`)
    if (data.settings) parts.push('설정')
    pushToast(`${parts.join(', ')} 데이터를 가져왔습니다.`)
  }

  const handleImportBookmarks = (
    request: BookmarkImportRequest,
  ): BookmarkImportOutcome => {
    const result = planBookmarkImport(request, favorites, categories)
    if (!result.ok) return result

    const { favorites: nextFavorites, categories: nextCategories, stats } = result.value
    setFavorites(nextFavorites)
    setCategories(nextCategories)
    setFilter('')
    setActiveCategoryId(ALL_CATEGORY_ID)
    setArranging(false)

    const parts = [`즐겨찾기 ${stats.added + stats.updated}개`]
    if (stats.categoriesCreated > 0) {
      parts.push(`새 카테고리 ${stats.categoriesCreated}개`)
    }
    if (stats.skippedDuplicateExisting + stats.skippedDuplicateFile > 0) {
      parts.push(
        `중복 건너뜀 ${stats.skippedDuplicateExisting + stats.skippedDuplicateFile}개`,
      )
    }
    pushToast(`Chrome 북마크에서 ${parts.join(', ')}를 가져왔습니다.`)

    return { ok: true, stats }
  }

  const handleReset = () => {
    setFavorites(createStarterFavorites())
    setCategories(createDefaultCategories())
    setSettings(createDefaultSettings())
    setActiveCategoryId(ALL_CATEGORY_ID)
    setFilter('')
    setArranging(false)
    setOverlay(null)
    pushToast('모든 데이터를 처음 상태로 초기화했습니다.')
  }

  const toggleTheme = () => {
    patchSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })
  }

  return (
    <div
      className="app"
      style={resolvedBackground.style}
      data-surface={resolvedBackground.surface}
      data-background={settings.background.type}
    >
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>

      <Header
        title={settings.siteTitle}
        theme={settings.theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => openSettings('general')}
      />

      <main id="main-content" className="home">
        <section className="hero" aria-labelledby="home-title">
          <h1 id="home-title" className="hero-title">
            {settings.heroTitle}
          </h1>
          <p className="hero-subtitle">원하는 사이트를 빠르게 찾아보세요</p>
          <SearchBar
            engine={settings.searchEngine}
            openInNewTab={settings.openInNewTab}
            inputRef={searchInputRef}
          />
        </section>

        <FavoritesGrid
          allFavorites={favorites}
          visibleFavorites={categoryFavorites}
          filteredFavorites={filteredFavorites}
          categories={categories}
          activeCategoryId={activeCategoryId}
          filter={filter}
          onFilterChange={setFilter}
          onSelectCategory={setActiveCategoryId}
          onManageCategories={() => setOverlay({ kind: 'categories' })}
          onOpenAdd={openAdd}
          onEditFavorite={(favorite) => setOverlay({ kind: 'editor', favorite })}
          onDeleteFavorite={(favorite) => setOverlay({ kind: 'delete', favorite })}
          onReorder={handleReorder}
          onMoveFavorite={handleMoveFavorite}
          onMoveToCategory={handleMoveToCategory}
          onRestoreDefaults={handleRestoreDefaults}
          arranging={arranging}
          onExitArrange={() => setArranging(false)}
        />
      </main>

      <footer className="home-footer">
        <button type="button" className="footer-link" onClick={openAdd}>
          즐겨찾기 추가
        </button>
        <span className="footer-separator" aria-hidden="true">·</span>
        <button
          type="button"
          className={`footer-link ${arranging ? 'is-active' : ''}`}
          onClick={() => setArranging((current) => !current)}
          aria-pressed={arranging}
        >
          {arranging ? '순서 변경 완료' : '순서 변경'}
        </button>
        <span className="footer-separator" aria-hidden="true">·</span>
        <button
          type="button"
          className="footer-link"
          onClick={() => openSettings('general')}
        >
          테마 설정
        </button>
        <span className="footer-separator" aria-hidden="true">·</span>
        <button
          type="button"
          className="footer-link"
          onClick={() => openSettings('data')}
        >
          데이터 관리
        </button>
      </footer>

      {overlay?.kind === 'editor' && (
        <FavoriteEditor
          favorite={overlay.favorite}
          favorites={favorites}
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          onSave={handleSaveFavorite}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === 'delete' && (
        <ConfirmDialog
          title="즐겨찾기 삭제"
          description={
            <>
              <p>
                <strong>{overlay.favorite.name}</strong> 즐겨찾기를 삭제할까요?
              </p>
              <p className="confirm-detail">{overlay.favorite.url}</p>
              <p className="confirm-note">삭제한 즐겨찾기는 되돌릴 수 없습니다.</p>
            </>
          }
          confirmLabel="삭제"
          onConfirm={confirmDelete}
          onCancel={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === 'categories' && (
        <CategoryManager
          categories={categories}
          favorites={favorites}
          onAdd={handleAddCategory}
          onRename={handleRenameCategory}
          onDelete={handleDeleteCategory}
          onMove={handleMoveCategory}
          onReorder={handleReorderCategory}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === 'settings' && (
        <SettingsPanel
          settings={settings}
          favorites={favorites}
          categories={categories}
          initialTab={overlay.tab}
          onPatchSettings={patchSettings}
          onExport={handleExport}
          onImport={handleImport}
          onImportBookmarks={handleImportBookmarks}
          onReset={handleReset}
          onClose={() => setOverlay(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
