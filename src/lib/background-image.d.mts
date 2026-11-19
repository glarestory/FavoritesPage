import type { BackgroundImageSource } from '../types'

export declare const ALLOWED_LOCAL_IMAGE_MIME_TYPES: readonly string[]
export declare const LOCAL_IMAGE_ACCEPT: string
export declare const MAX_LOCAL_IMAGE_FILE_BYTES: number
export declare const MAX_LOCAL_IMAGE_DATA_URL_LENGTH: number
export declare const MAX_LOCAL_IMAGE_DIMENSION: number
export declare const PASS_THROUGH_DATA_URL_LENGTH: number
export declare const MAX_BACKGROUND_FILE_NAME_LENGTH: number

export declare function inferImageMimeFromName(name: string): string
export declare function normalizeBackgroundFileName(value: unknown): string | undefined
export declare function isLocalImageDataUrl(value: unknown): boolean

export declare function validateLocalImageDataUrl(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string }

export declare function validateLocalImageFileMeta(file: {
  type?: string
  size?: number
  name?: string
}): { ok: true; mime: string } | { ok: false; error: string }

export declare function getBackgroundImageSource(background: {
  source?: BackgroundImageSource
  url?: string
}): BackgroundImageSource

export declare function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension?: number,
): { width: number; height: number; resized: boolean }

export declare function formatFileSize(bytes: number): string
