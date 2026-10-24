import type { CSSProperties } from 'react'
import type { BackgroundSettings, GradientId, ThemeMode } from '../types'

export interface GradientPreset {
  id: GradientId
  label: string
  css: string
  dark: boolean
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'daylight',
    label: '데이라이트',
    css: 'linear-gradient(155deg, #f8fbff 0%, #eef4fd 50%, #f7f9fc 100%)',
    dark: false,
  },
  {
    id: 'mist',
    label: '안개',
    css: 'linear-gradient(150deg, #f7f7fb 0%, #e8edf7 52%, #f1f5fb 100%)',
    dark: false,
  },
  {
    id: 'mint',
    label: '민트',
    css: 'linear-gradient(150deg, #f5fbf8 0%, #e4f4ec 55%, #f2f8f5 100%)',
    dark: false,
  },
  {
    id: 'lavender',
    label: '라벤더',
    css: 'linear-gradient(150deg, #faf8ff 0%, #efe9fb 55%, #f6f2ff 100%)',
    dark: false,
  },
  {
    id: 'midnight',
    label: '미드나이트',
    css: 'linear-gradient(155deg, #0b1020 0%, #111a2e 55%, #0a1220 100%)',
    dark: true,
  },
  {
    id: 'graphite',
    label: '그래파이트',
    css: 'linear-gradient(155deg, #17191d 0%, #23262c 55%, #15171b 100%)',
    dark: true,
  },
]

export const COLOR_SWATCHES = [
  { value: '#eef3fb', label: '안개빛 파랑' },
  { value: '#f7f3ec', label: '아이보리' },
  { value: '#eaf5ef', label: '연한 민트' },
  { value: '#fbeef1', label: '연한 분홍' },
  { value: '#f1edfb', label: '연한 라벤더' },
  { value: '#e8eef3', label: '쿨 그레이' },
  { value: '#28303d', label: '차콜' },
  { value: '#111827', label: '밤색' },
] as const

const DEFAULT_LIGHT_BACKGROUND =
  'linear-gradient(155deg, #f8fbff 0%, #edf3fc 48%, #f6f8fc 100%)'
const DEFAULT_DARK_BACKGROUND =
  'linear-gradient(155deg, #0a0f18 0%, #101827 52%, #0b111b 100%)'

export interface ResolvedBackground {
  style: CSSProperties
  surface: 'light' | 'dark'
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized
  if (!/^[\da-f]{6}$/i.test(expanded)) return 1

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(expanded.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.42
}

export function resolveBackground(
  background: BackgroundSettings,
  theme: ThemeMode,
): ResolvedBackground {
  if (background.type === 'color') {
    return {
      style: { background: background.color },
      surface: isDarkColor(background.color) ? 'dark' : 'light',
    }
  }

  if (background.type === 'gradient') {
    const preset = GRADIENT_PRESETS.find((item) => item.id === background.gradient)
    return {
      style: { background: preset?.css ?? DEFAULT_LIGHT_BACKGROUND },
      surface: preset?.dark ? 'dark' : 'light',
    }
  }

  if (background.type === 'image') {
    const overlay = Math.min(0.85, Math.max(0, background.overlay))
    const safeUrl = background.url.replace(/"/g, '%22').replace(/\r|\n/g, '')
    return {
      style: {
        backgroundImage: `linear-gradient(rgba(8, 13, 22, ${overlay}), rgba(8, 13, 22, ${overlay})), url("${safeUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      },
      surface: 'dark',
    }
  }

  return {
    style: {
      background: theme === 'dark' ? DEFAULT_DARK_BACKGROUND : DEFAULT_LIGHT_BACKGROUND,
    },
    surface: theme === 'dark' ? 'dark' : 'light',
  }
}
