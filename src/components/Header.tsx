import type { ThemeMode } from '../types'
import { GridIcon, MoonIcon, SettingsIcon, SunIcon } from './Icons'

interface HeaderProps {
  title: string
  theme: ThemeMode
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function Header({ title, theme, onToggleTheme, onOpenSettings }: HeaderProps) {
  const isLight = theme === 'light'

  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <GridIcon size={18} />
        </span>
        <span className="brand-name">{title}</span>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={isLight ? '다크 모드로 전환' : '라이트 모드로 전환'}
          title={isLight ? '다크 모드로 전환' : '라이트 모드로 전환'}
        >
          {isLight ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          aria-label="설정 열기"
          title="설정"
        >
          <SettingsIcon size={20} />
        </button>
      </div>
    </header>
  )
}
