import {
  computeResizedDimensions,
  MAX_LOCAL_IMAGE_DATA_URL_LENGTH,
  MAX_LOCAL_IMAGE_DIMENSION,
  normalizeBackgroundFileName,
  PASS_THROUGH_DATA_URL_LENGTH,
  validateLocalImageDataUrl,
  validateLocalImageFileMeta,
} from './background-image.mjs'

export type PreparedLocalImage =
  | {
      ok: true
      dataUrl: string
      fileName: string
      width: number
      height: number
      optimized: boolean
    }
  | { ok: false; error: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('이미지 데이터를 문자열로 읽지 못했습니다.'))
      }
    }
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve(image)
      } else {
        reject(new Error('유효한 이미지 크기를 확인할 수 없습니다.'))
      }
    }
    image.onerror = () => reject(new Error('이미지를 디코딩하지 못했습니다.'))
    image.src = src
  })
}

function encodeImageWithCanvas(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  preferWebp: boolean,
  quality: number,
): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return null

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  if (preferWebp) {
    const webp = canvas.toDataURL('image/webp', quality)
    if (webp.startsWith('data:image/webp;base64,')) {
      return webp
    }
  }

  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * 로컬 이미지 파일을 검증하고 브라우저 저장소에 보관하기 적합한 크기로 최적화합니다.
 * - 애니메이션 GIF나 이미 작은 이미지는 원본을 유지합니다.
 * - 큰 이미지는 비율을 유지하며 리사이즈·압축합니다.
 */
export async function prepareLocalBackgroundImage(file: File): Promise<PreparedLocalImage> {
  const meta = validateLocalImageFileMeta(file)
  if (!meta.ok) return { ok: false, error: meta.error }

  const fileName = normalizeBackgroundFileName(file.name) ?? '로컬 이미지'
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(objectUrl)
    const naturalWidth = image.naturalWidth
    const naturalHeight = image.naturalHeight

    // GIF는 애니메이션 유지를 위해 제한 용량 이내라면 원본 그대로 사용합니다.
    const estimatedBase64Length = Math.ceil((file.size * 4) / 3) + 64
    const withinDimensions =
      Math.max(naturalWidth, naturalHeight) <= MAX_LOCAL_IMAGE_DIMENSION

    if (
      (meta.mime === 'image/gif' && estimatedBase64Length <= MAX_LOCAL_IMAGE_DATA_URL_LENGTH) ||
      (withinDimensions && estimatedBase64Length <= PASS_THROUGH_DATA_URL_LENGTH)
    ) {
      const rawDataUrl = await readFileAsDataUrl(file)
      const validated = validateLocalImageDataUrl(rawDataUrl)
      if (validated.ok) {
        return {
          ok: true,
          dataUrl: validated.value,
          fileName,
          width: naturalWidth,
          height: naturalHeight,
          optimized: false,
        }
      }
    }

    // 해상도와 품질을 단계적으로 조절하며 저장 한도 이내의 최적 Data URL을 생성합니다.
    const dimensionSteps = [MAX_LOCAL_IMAGE_DIMENSION, 1440, 1080]
    const qualitySteps = [0.86, 0.78, 0.68, 0.56]

    for (const maxDim of dimensionSteps) {
      const dims = computeResizedDimensions(naturalWidth, naturalHeight, maxDim)
      for (const quality of qualitySteps) {
        const encoded = encodeImageWithCanvas(image, dims.width, dims.height, true, quality)
        if (!encoded) continue
        const validated = validateLocalImageDataUrl(encoded)
        if (validated.ok) {
          return {
            ok: true,
            dataUrl: validated.value,
            fileName,
            width: dims.width,
            height: dims.height,
            optimized: true,
          }
        }
      }
    }

    return {
      ok: false,
      error: '이미지 용량이 커서 저장할 수 없습니다. 해상도가 더 작은 이미지를 선택해 주세요.',
    }
  } catch {
    return {
      ok: false,
      error: '이미지 파일을 불러올 수 없습니다. 손상되지 않은 이미지 파일인지 확인해 주세요.',
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
