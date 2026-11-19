import { useEffect, useRef, useState } from 'react'
import type {
  DragEvent as ReactDragEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react'
import type {
  BackgroundImageSource,
  BackgroundSettings,
  Category,
  Favorite,
  Settings,
  SettingsTab,
} from '../types'
import type { ImportedData } from '../lib/backup'
import type {
  BookmarkImportOutcome,
  BookmarkImportRequest,
} from '../lib/bookmarks'
import { parseBackup } from '../lib/backup'
import {
  COLOR_SWATCHES,
  GRADIENT_PRESETS,
  resolveBackground,
} from '../lib/background'
import {
  getBackgroundImageSource,
  LOCAL_IMAGE_ACCEPT,
  MAX_LOCAL_IMAGE_FILE_BYTES,
} from '../lib/background-image.mjs'
import { prepareLocalBackgroundImage } from '../lib/local-image'
import { SEARCH_ENGINES } from '../lib/search'
import { validateWebUrl } from '../lib/url'
import { Dialog } from './Dialog'
import { BookmarkImportPanel } from './BookmarkImportPanel'
import { PageTitleFields } from './PageTitleFields'
import {
  AlertTriangleIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  ImageIcon,
  LinkIcon,
  MoonIcon,
  PaletteIcon,
  RotateCcwIcon,
  SettingsIcon,
  SunIcon,
  UploadIcon,
} from './Icons'

export interface ChromeSyncDisplayInfo {
  status: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedAt: number | null
  usedBytes: number | null
  maxBytes: number
  error: string | null
}

interface SettingsPanelProps {
  settings: Settings
  favorites: Favorite[]
  categories: Category[]
  initialTab: SettingsTab
  chromeSync?: ChromeSyncDisplayInfo | null
  onSyncNow?: () => Promise<void>
  onPatchSettings: (patch: Partial<Settings>) => void
  onExport: () => void
  onImport: (data: ImportedData) => void
  onImportBookmarks: (request: BookmarkImportRequest) => BookmarkImportOutcome
  onReset: () => void
  onClose: () => void
}

type ImageState = 'idle' | 'checking' | 'processing'

const MAX_LOCAL_IMAGE_MB = Math.round(MAX_LOCAL_IMAGE_FILE_BYTES / (1024 * 1024))

const IMAGE_SOURCE_OPTIONS: Array<{
  id: BackgroundImageSource
  label: string
  icon: ReactNode
}> = [
  { id: 'local', label: '내 기기에서 선택', icon: <UploadIcon size={15} /> },
  { id: 'url', label: '이미지 URL', icon: <LinkIcon size={15} /> },
]

type ImportState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ImportedData; fileName: string }
  | { status: 'done'; message: string }

const TABS: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: 'general', label: '일반', icon: <SettingsIcon size={17} /> },
  { id: 'background', label: '배경', icon: <PaletteIcon size={17} /> },
  { id: 'data', label: '데이터', icon: <DatabaseIcon size={17} /> },
]

const THEME_OPTIONS = [
  { value: 'light' as const, label: '라이트', description: '밝고 깨끗한 화면', icon: <SunIcon size={18} /> },
  { value: 'dark' as const, label: '다크', description: '눈이 편안한 어두운 화면', icon: <MoonIcon size={18} /> },
]

const BACKGROUND_TYPES: Array<{
  id: BackgroundSettings['type']
  label: string
  icon: ReactNode
}> = [
  { id: 'default', label: '기본', icon: <PaletteIcon size={16} /> },
  { id: 'color', label: '단색', icon: <span className="color-type-dot" aria-hidden="true" /> },
  { id: 'gradient', label: '그라데이션', icon: <span className="gradient-type-dot" aria-hidden="true" /> },
  { id: 'image', label: '이미지', icon: <ImageIcon size={16} /> },
]

export function SettingsPanel({
  settings,
  favorites,
  categories,
  initialTab,
  chromeSync = null,
  onSyncNow,
  onPatchSettings,
  onExport,
  onImport,
  onImportBookmarks,
  onReset,
  onClose,
}: SettingsPanelProps) {
  const initialImageSource: BackgroundImageSource =
    settings.background.type === 'image'
      ? getBackgroundImageSource(settings.background)
      : 'local'

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [selectedType, setSelectedType] = useState<BackgroundSettings['type']>(
    settings.background.type,
  )
  const [imageSource, setImageSource] = useState<BackgroundImageSource>(initialImageSource)
  const [imageUrl, setImageUrl] = useState(
    settings.background.type === 'image' && initialImageSource === 'url'
      ? settings.background.url
      : '',
  )
  const [imageError, setImageError] = useState('')
  const [imageStatus, setImageStatus] = useState('')
  const [imageState, setImageState] = useState<ImageState>('idle')
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' })
  const [resetConfirm, setResetConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const localImageInputRef = useRef<HTMLInputElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const imageRequestIdRef = useRef(0)

  useEffect(() => {
    setSelectedType(settings.background.type)
    if (settings.background.type === 'image') {
      const source = getBackgroundImageSource(settings.background)
      setImageSource(source)
      if (source === 'url') setImageUrl(settings.background.url)
    }
  }, [settings.background])

  useEffect(() => {
    return () => {
      imageRequestIdRef.current += 1
    }
  }, [])

  const backgroundPreview = resolveBackground(settings.background, settings.theme)
  const colorValue =
    settings.background.type === 'color' ? settings.background.color : '#eef3fb'
  const overlay = settings.background.type === 'image' ? settings.background.overlay : 0.45
  const appliedImageSource: BackgroundImageSource | null =
    settings.background.type === 'image'
      ? getBackgroundImageSource(settings.background)
      : null
  const appliedFileName =
    settings.background.type === 'image'
      ? settings.background.fileName ?? '로컬 이미지'
      : ''

  const selectTab = (tab: SettingsTab) => setActiveTab(tab)

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    const nextTab = TABS[nextIndex]!
    setActiveTab(nextTab.id)
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-tab-${nextTab.id}`)?.focus()
    })
  }

  const selectBackgroundType = (type: BackgroundSettings['type']) => {
    imageRequestIdRef.current += 1
    setSelectedType(type)
    setImageError('')
    setImageStatus('')
    setImageState('idle')
    setIsDraggingImage(false)
    if (type === 'default') {
      onPatchSettings({ background: { type: 'default' } })
    } else if (type === 'color') {
      onPatchSettings({
        background: {
          type: 'color',
          color: settings.background.type === 'color' ? settings.background.color : '#eef3fb',
        },
      })
    } else if (type === 'gradient') {
      onPatchSettings({
        background: {
          type: 'gradient',
          gradient:
            settings.background.type === 'gradient' ? settings.background.gradient : 'daylight',
        },
      })
    }
  }

  const selectImageSource = (source: BackgroundImageSource) => {
    setImageSource(source)
    setImageError('')
    setImageStatus('')
    setIsDraggingImage(false)
  }

  const handleLocalImageFile = async (file: File | undefined) => {
    if (!file) return

    const requestId = imageRequestIdRef.current + 1
    imageRequestIdRef.current = requestId

    setImageError('')
    setImageStatus('')
    setImageState('processing')

    try {
      const result = await prepareLocalBackgroundImage(file)
      if (imageRequestIdRef.current !== requestId) return

      setImageState('idle')
      if (!result.ok) {
        setImageError(result.error)
        return
      }

      onPatchSettings({
        background: {
          type: 'image',
          url: result.dataUrl,
          overlay: settings.background.type === 'image' ? settings.background.overlay : 0.45,
          source: 'local',
          fileName: result.fileName,
        },
      })
      setImageStatus(
        result.optimized
          ? `${result.fileName} 이미지를 최적화해 배경으로 적용했습니다.`
          : `${result.fileName} 이미지를 배경으로 적용했습니다.`,
      )
    } finally {
      if (localImageInputRef.current) localImageInputRef.current.value = ''
    }
  }

  const handleLocalImageDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (imageState === 'processing') return
    setIsDraggingImage(true)
  }

  const handleLocalImageDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (imageState === 'processing') return
    event.dataTransfer.dropEffect = 'copy'
    if (!isDraggingImage) setIsDraggingImage(true)
  }

  const handleLocalImageDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDraggingImage(false)
  }

  const handleLocalImageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingImage(false)
    if (imageState === 'processing') return
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) void handleLocalImageFile(droppedFile)
  }

  const applyImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validated = validateWebUrl(imageUrl, '배경 이미지 URL')
    if (!validated.ok) {
      setImageError(validated.error)
      setImageStatus('')
      return
    }

    const requestId = imageRequestIdRef.current + 1
    imageRequestIdRef.current = requestId

    setImageError('')
    setImageStatus('')
    setImageState('checking')

    const loaded = await new Promise<boolean>((resolve) => {
      const image = new Image()
      let settled = false
      const timer = window.setTimeout(() => {
        if (settled) return
        settled = true
        resolve(false)
      }, 10_000)

      image.onload = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(true)
      }
      image.onerror = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(false)
      }
      image.src = validated.value
    })

    if (imageRequestIdRef.current !== requestId) return

    setImageState('idle')
    if (!loaded) {
      setImageError('이미지를 불러올 수 없습니다. 접근 가능한 이미지 주소인지 확인해 주세요.')
      return
    }

    onPatchSettings({
      background: {
        type: 'image',
        url: validated.value,
        overlay: settings.background.type === 'image' ? settings.background.overlay : 0.45,
        source: 'url',
      },
    })
    setImageStatus('이미지 URL을 배경으로 적용했습니다.')
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setImportState({ status: 'error', message: '5MB 이하의 JSON 파일만 가져올 수 있습니다.' })
      return
    }

    setImportState({ status: 'reading' })
    try {
      const text = await file.text()
      const result = parseBackup(text)
      if (!result.ok) {
        setImportState({ status: 'error', message: result.error })
      } else {
        setImportState({ status: 'ready', data: result.value, fileName: file.name })
      }
    } catch {
      setImportState({ status: 'error', message: '파일을 읽지 못했습니다. 다시 시도해 주세요.' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmImport = () => {
    if (importState.status !== 'ready') return
    const { data, fileName } = importState
    onImport(data)

    const importedParts = [`즐겨찾기 ${data.favorites.length}개`]
    if (data.categories) importedParts.push(`카테고리 ${data.categories.length}개`)
    if (data.settings) importedParts.push('설정')

    let keptMessage = ''
    if (!data.categories && !data.settings) {
      keptMessage = ' 기존 카테고리와 설정은 유지됩니다.'
    } else if (!data.categories) {
      keptMessage = ' 기존 카테고리는 유지됩니다.'
    } else if (!data.settings) {
      keptMessage = ' 설정은 유지됩니다.'
    }

    setImportState({
      status: 'done',
      message: `${fileName}에서 ${importedParts.join(', ')} 데이터를 가져왔습니다.${keptMessage}`,
    })
  }

  return (
    <Dialog
      title="설정"
      subtitle="시작 페이지를 나에게 맞게 설정하세요."
      variant="drawer"
      onClose={onClose}
      initialFocusSelector={`#settings-tab-${initialTab}`}
    >
      <div className="settings-tabs" role="tablist" aria-label="설정 섹션">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`settings-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div
          id="settings-panel-general"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          className="settings-panel"
        >
          <PageTitleFields settings={settings} onPatchSettings={onPatchSettings} />

          <fieldset className="settings-section">
            <legend>테마</legend>
            <p className="section-description">화면 밝기와 대비를 선택합니다.</p>
            <div className="choice-grid choice-grid--theme">
              {THEME_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`choice-card ${settings.theme === option.value ? 'is-selected' : ''}`}
                >
                  <input
                    className="choice-input"
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={settings.theme === option.value}
                    onChange={() => onPatchSettings({ theme: option.value })}
                  />
                  <span className="choice-icon" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className="choice-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="choice-check" aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="settings-section">
            <legend>검색 엔진</legend>
            <p className="section-description">검색창에서 Enter를 눌렀을 때 사용할 엔진입니다.</p>
            <div className="choice-grid choice-grid--engines">
              {SEARCH_ENGINES.map((engine) => (
                <label
                  key={engine.id}
                  className={`choice-card choice-card--compact ${
                    settings.searchEngine === engine.id ? 'is-selected' : ''
                  }`}
                >
                  <input
                    className="choice-input"
                    type="radio"
                    name="search-engine"
                    value={engine.id}
                    checked={settings.searchEngine === engine.id}
                    onChange={() => onPatchSettings({ searchEngine: engine.id })}
                  />
                  <span className="choice-copy">
                    <strong>{engine.name}</strong>
                    <small>{engine.description}</small>
                  </span>
                  <span className="choice-check" aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="settings-section">
            <div className="setting-row">
              <div>
                <p id="open-new-tab-label" className="setting-row-title">
                  검색 결과를 새 탭에서 열기
                </p>
                <p className="setting-row-description">
                  검색 결과를 새 탭에서 엽니다. 즐겨찾기는 항상 새 탭에서 열립니다.
                </p>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.openInNewTab}
                aria-labelledby="open-new-tab-label"
                onClick={() => onPatchSettings({ openInNewTab: !settings.openInNewTab })}
              >
                <span className="switch-thumb" />
              </button>
            </div>
            <div className="setting-row setting-row--divider">
              <div>
                <p id="side-widgets-label" className="setting-row-title">
                  좌우 사이드 위젯 표시
                </p>
                <p className="setting-row-description">
                  미니 캘린더, D-Day, 빠른 메모, 포모도로 타이머를 좌우 공간에 표시합니다.
                </p>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.showSideWidgets}
                aria-labelledby="side-widgets-label"
                onClick={() =>
                  onPatchSettings({ showSideWidgets: !settings.showSideWidgets })
                }
              >
                <span className="switch-thumb" />
              </button>
            </div>
          </div>

          <div className="shortcut-card">
            <p className="shortcut-title">키보드 단축키</p>
            <p className="shortcut-row">
              <kbd>Ctrl</kbd> + <kbd>K</kbd> 검색창으로 이동
            </p>
            <p className="shortcut-row">
              <kbd>Esc</kbd> 모달, 메뉴 또는 이 설정 닫기
            </p>
            <p className="shortcut-row">
              <kbd>Tab</kbd> 다음 항목으로 이동
            </p>
          </div>
        </div>
      )}

      {activeTab === 'background' && (
        <div
          id="settings-panel-background"
          role="tabpanel"
          aria-labelledby="settings-tab-background"
          className="settings-panel"
        >
          <div
            className="background-preview"
            style={backgroundPreview.style}
            data-preview-surface={backgroundPreview.surface}
            aria-hidden="true"
          >
            <span className="background-preview-bar" />
            <span className="background-preview-label">배경 미리보기</span>
          </div>

          <fieldset className="settings-section">
            <legend>배경 유형</legend>
            <div className="type-grid" role="group" aria-label="배경 유형 선택">
              {BACKGROUND_TYPES.map((type) => (
                <label
                  key={type.id}
                  className={`type-option ${selectedType === type.id ? 'is-selected' : ''}`}
                >
                  <input
                    className="choice-input"
                    type="radio"
                    name="background-type"
                    value={type.id}
                    checked={selectedType === type.id}
                    onChange={() => selectBackgroundType(type.id)}
                  />
                  {type.icon}
                  <span>{type.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {selectedType === 'color' && (
            <div className="settings-section">
              <p className="field-label">색상 선택</p>
              <div className="swatch-grid">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    className={`color-swatch ${
                      colorValue.toLowerCase() === swatch.value.toLowerCase() ? 'is-selected' : ''
                    }`}
                    style={{ backgroundColor: swatch.value }}
                    onClick={() =>
                      onPatchSettings({ background: { type: 'color', color: swatch.value } })
                    }
                    aria-label={`${swatch.label} 배경색`}
                    aria-pressed={colorValue.toLowerCase() === swatch.value.toLowerCase()}
                  />
                ))}
              </div>
              <label className="custom-color-field" htmlFor="custom-background-color">
                <span>사용자 지정 색상</span>
                <input
                  id="custom-background-color"
                  type="color"
                  value={colorValue}
                  onChange={(event) =>
                    onPatchSettings({
                      background: { type: 'color', color: event.target.value },
                    })
                  }
                />
                <code>{colorValue}</code>
              </label>
            </div>
          )}

          {selectedType === 'gradient' && (
            <div className="settings-section">
              <p className="field-label">그라데이션 선택</p>
              <div className="gradient-grid">
                {GRADIENT_PRESETS.map((preset) => {
                  const isSelected =
                    settings.background.type === 'gradient' &&
                    settings.background.gradient === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`gradient-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() =>
                        onPatchSettings({
                          background: { type: 'gradient', gradient: preset.id },
                        })
                      }
                      aria-pressed={isSelected}
                    >
                      <span className="gradient-preview" style={{ background: preset.css }} />
                      <span className="gradient-label">
                        {preset.label}
                        {isSelected && <CheckIcon size={14} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedType === 'image' && (
            <div className="settings-section">
              <fieldset className="image-source-fieldset">
                <legend className="field-label">이미지 추가 방식</legend>
                <div className="image-source-grid">
                  {IMAGE_SOURCE_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`image-source-option ${
                        imageSource === option.id ? 'is-selected' : ''
                      }`}
                    >
                      <input
                        className="choice-input"
                        type="radio"
                        name="background-image-source"
                        value={option.id}
                        checked={imageSource === option.id}
                        onChange={() => selectImageSource(option.id)}
                      />
                      {option.icon}
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {imageSource === 'local' ? (
                <div className="image-local-panel">
                  <input
                    ref={localImageInputRef}
                    id="background-image-file"
                    type="file"
                    accept={LOCAL_IMAGE_ACCEPT}
                    aria-label="로컬 배경 이미지 선택"
                    className="visually-hidden-input"
                    onChange={(event) => void handleLocalImageFile(event.target.files?.[0])}
                  />
                  <div
                    className={`image-dropzone ${isDraggingImage ? 'is-dragging' : ''} ${
                      imageState === 'processing' ? 'is-busy' : ''
                    }`}
                    onDragEnter={handleLocalImageDragEnter}
                    onDragOver={handleLocalImageDragOver}
                    onDragLeave={handleLocalImageDragLeave}
                    onDrop={handleLocalImageDrop}
                  >
                    <span className="image-dropzone-icon" aria-hidden="true">
                      <UploadIcon size={20} />
                    </span>
                    <p className="image-dropzone-title">
                      {isDraggingImage
                        ? '여기에 이미지를 놓으면 배경으로 적용됩니다'
                        : '이미지 파일을 끌어다 놓거나 직접 선택하세요'}
                    </p>
                    <p id="background-local-help" className="image-dropzone-hint">
                      JPG, PNG, WebP, GIF, AVIF · 최대 {MAX_LOCAL_IMAGE_MB}MB (자동 최적화)
                    </p>
                    <button
                      type="button"
                      className="button button--secondary button--compact"
                      onClick={() => localImageInputRef.current?.click()}
                      disabled={imageState === 'processing'}
                      aria-describedby={
                        imageError ? 'background-image-error' : 'background-local-help'
                      }
                    >
                      {imageState === 'processing' ? '이미지 처리 중...' : '이미지 파일 선택'}
                    </button>
                  </div>
                  {imageError && (
                    <p id="background-image-error" className="field-error" role="alert">
                      {imageError}
                    </p>
                  )}
                  {!imageError && imageStatus && (
                    <p className="field-status" role="status">
                      {imageStatus}
                    </p>
                  )}
                </div>
              ) : (
                <form className="image-form" onSubmit={applyImage} noValidate>
                  <label htmlFor="background-image-url">이미지 URL</label>
                  <div className="image-url-row">
                    <input
                      id="background-image-url"
                      name="background-image-url"
                      type="text"
                      value={imageUrl}
                      placeholder="https://example.com/background.jpg"
                      inputMode="url"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={Boolean(imageError)}
                      aria-describedby={
                        imageError ? 'background-image-error' : 'background-image-help'
                      }
                      onChange={(event) => {
                        setImageUrl(event.target.value)
                        if (imageError) setImageError('')
                        if (imageStatus) setImageStatus('')
                      }}
                    />
                    <button
                      type="submit"
                      className="button button--primary button--compact"
                      disabled={imageState === 'checking'}
                    >
                      {imageState === 'checking' ? '확인 중...' : '적용'}
                    </button>
                  </div>
                  {imageError ? (
                    <p id="background-image-error" className="field-error" role="alert">
                      {imageError}
                    </p>
                  ) : imageStatus ? (
                    <p className="field-status" role="status">
                      {imageStatus}
                    </p>
                  ) : (
                    <p id="background-image-help" className="field-help">
                      접근 가능한 이미지 주소를 입력하면 배경으로 적용됩니다. 가로형 이미지를
                      권장합니다.
                    </p>
                  )}
                </form>
              )}

              {settings.background.type === 'image' ? (
                <div className="applied-background">
                  <div className="applied-background-head">
                    <span className="applied-dot" aria-hidden="true" />
                    <p>
                      {appliedImageSource === 'local'
                        ? '로컬 이미지 배경이 적용되어 있습니다.'
                        : '이미지 배경이 적용되어 있습니다.'}
                    </p>
                    <span className="applied-badge">
                      {appliedImageSource === 'local' ? '내 기기' : 'URL'}
                    </span>
                  </div>
                  <p
                    className="applied-url"
                    title={
                      appliedImageSource === 'local'
                        ? appliedFileName
                        : settings.background.url
                    }
                  >
                    {appliedImageSource === 'local'
                      ? appliedFileName
                      : settings.background.url}
                  </p>
                  <label className="range-field" htmlFor="background-overlay">
                    <span>
                      이미지 어둡게
                      <output>{Math.round(overlay * 100)}%</output>
                    </span>
                    <input
                      id="background-overlay"
                      type="range"
                      min="0"
                      max="0.85"
                      step="0.05"
                      value={overlay}
                      onChange={(event) => {
                        if (settings.background.type !== 'image') return
                        onPatchSettings({
                          background: {
                            ...settings.background,
                            overlay: Number(event.target.value),
                          },
                        })
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setImageError('')
                      setImageStatus('')
                      onPatchSettings({ background: { type: 'default' } })
                    }}
                  >
                    이미지 배경 제거
                  </button>
                </div>
              ) : (
                <p className="section-note">
                  {imageSource === 'local'
                    ? '이미지를 선택하면 바로 배경에 적용됩니다. 로컬 이미지는 브라우저 저장소와 JSON 백업에 함께 보관됩니다.'
                    : '이미지 주소를 적용하면 배경이 변경됩니다. 적용 전에는 이전 배경이 유지됩니다.'}
                </p>
              )}
            </div>
          )}

          {selectedType === 'default' && (
            <p className="section-note">
              선택한 테마에 어울리는 기본 배경을 사용합니다.
            </p>
          )}
        </div>
      )}

      {activeTab === 'data' && (
        <div
          id="settings-panel-data"
          role="tabpanel"
          aria-labelledby="settings-tab-data"
          className="settings-panel"
        >
          {chromeSync && (
            <section className="data-card data-card--stacked" aria-label="Chrome 동기화 상태">
              <div className="data-card-heading">
                <span className="data-card-icon" aria-hidden="true">
                  <DatabaseIcon size={20} />
                </span>
                <div className="data-card-copy">
                  <h3>Chrome 계정 자동 동기화</h3>
                  <p>
                    즐겨찾기, 카테고리, 설정, 캘린더 메모, D-Day, 빠른 메모, 포모도로가
                    로그인된 Chrome 계정으로 자동 동기화됩니다. 로컬 배경 이미지와 로컬
                    아이콘은 현재 기기에만 보관됩니다.
                  </p>
                </div>
              </div>
              <div className="sync-status-row">
                <span className={`sync-pill is-${chromeSync.status}`}>
                  {chromeSync.status === 'syncing'
                    ? '동기화 중...'
                    : chromeSync.status === 'error'
                      ? '동기화 오류'
                      : '동기화 활성'}
                </span>
                {chromeSync.lastSyncedAt && (
                  <span className="sync-meta">
                    최근 동기화:{' '}
                    {new Date(chromeSync.lastSyncedAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {chromeSync.usedBytes !== null && (
                  <span className="sync-meta">
                    {Math.round(chromeSync.usedBytes / 1024)}KB /{' '}
                    {Math.round(chromeSync.maxBytes / 1024)}KB
                  </span>
                )}
                {onSyncNow && (
                  <button
                    type="button"
                    className="button button--secondary button--compact sync-now-button"
                    disabled={chromeSync.status === 'syncing'}
                    onClick={() => void onSyncNow()}
                  >
                    지금 동기화
                  </button>
                )}
              </div>
              {chromeSync.error && (
                <div className="import-message import-message--error" role="alert">
                  <AlertTriangleIcon size={17} />
                  <p>{chromeSync.error}</p>
                </div>
              )}
            </section>
          )}

          <BookmarkImportPanel
            favorites={favorites}
            categories={categories}
            onImport={onImportBookmarks}
          />

          <section className="data-card">
            <span className="data-card-icon" aria-hidden="true">
              <DownloadIcon size={20} />
            </span>
            <div className="data-card-copy">
              <h3>JSON으로 내보내기</h3>
              <p>
                즐겨찾기 {favorites.length}개, 카테고리 {categories.length}개,
                설정과 사이드 위젯(캘린더 메모·D-Day·빠른 메모)을 파일로 저장합니다.
              </p>
            </div>
            <button type="button" className="button button--secondary" onClick={onExport}>
              내보내기
            </button>
          </section>

          <section className="data-card data-card--stacked">
            <div className="data-card-heading">
              <span className="data-card-icon" aria-hidden="true">
                <UploadIcon size={20} />
              </span>
              <div className="data-card-copy">
                <h3>JSON에서 가져오기</h3>
                <p>백업 파일을 검사한 뒤 현재 데이터를 대체합니다.</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              id="backup-file-input"
              type="file"
              accept=".json,application/json"
              aria-label="백업 파일 선택"
              className="visually-hidden-input"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className="button button--secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importState.status === 'reading'}
            >
              {importState.status === 'reading' ? '파일 읽는 중...' : '백업 파일 선택'}
            </button>

            {importState.status === 'error' && (
              <div className="import-message import-message--error" role="alert">
                <AlertTriangleIcon size={17} />
                <p>{importState.message}</p>
              </div>
            )}

            {importState.status === 'ready' && (
              <div className="import-preview">
                <p className="import-preview-title">{importState.fileName}</p>
                <p>
                  가져올 데이터: 즐겨찾기{' '}
                  <strong>{importState.data.favorites.length}개</strong>
                  {importState.data.categories
                    ? `, 카테고리 ${importState.data.categories.length}개`
                    : ''}
                  {importState.data.settings ? ', 설정' : ''}
                </p>
                <p className="import-warning">
                  현재 저장된 데이터: 즐겨찾기 {favorites.length}개
                  {importState.data.categories
                    ? `, 카테고리 ${categories.length}개`
                    : ''}
                  {importState.data.settings ? ', 설정' : ''}. 가져온 데이터로
                  교체됩니다.
                  {!importState.data.categories
                    ? ' 기존 카테고리는 유지됩니다.'
                    : ''}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setImportState({ status: 'idle' })}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={confirmImport}
                  >
                    가져오기
                  </button>
                </div>
              </div>
            )}

            {importState.status === 'done' && (
              <div className="import-message import-message--success" role="status">
                <CheckIcon size={17} />
                <p>{importState.message}</p>
              </div>
            )}
          </section>

          <section className="danger-zone">
            <div>
              <h3>모든 데이터 초기화</h3>
              <p>
                즐겨찾기, 카테고리와 모든 설정을 처음 상태로 되돌립니다. 이 작업은
                되돌릴 수 없습니다.
              </p>
            </div>
            {resetConfirm ? (
              <div className="inline-confirm" role="alert">
                <AlertTriangleIcon size={19} />
                <p>정말 모든 데이터를 초기화할까요?</p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => {
                      setResetConfirm(false)
                      window.requestAnimationFrame(() => resetTriggerRef.current?.focus())
                    }}
                    autoFocus
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button button--danger button--compact"
                    onClick={onReset}
                  >
                    초기화
                  </button>
                </div>
              </div>
            ) : (
              <button
                ref={resetTriggerRef}
                type="button"
                className="button button--danger-ghost"
                onClick={() => setResetConfirm(true)}
              >
                <RotateCcwIcon size={16} />
                초기화
              </button>
            )}
          </section>

          <p className="data-note">
            {chromeSync
              ? '즐겨찾기·카테고리·설정·위젯은 Chrome 계정(chrome.storage.sync)으로 동기화되며, 로컬 배경 이미지와 로컬 아이콘은 현재 기기(chrome.storage.local)에 저장됩니다.'
              : '모든 데이터는 이 브라우저의 localStorage에 저장됩니다. 다른 기기로 옮기려면 JSON 파일로 내보낸 뒤 가져오세요.'}
          </p>
        </div>
      )}
    </Dialog>
  )
}
