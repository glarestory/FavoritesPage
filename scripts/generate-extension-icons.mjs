// extension/icons/icon-{16,48,128}.png 아이콘을 생성하는 스크립트입니다.
// public/favicon.svg(파란 둥근 사각형 + 흰색 2x2 격자) 디자인을 안티앨리어싱된 실제 PNG로 렌더링합니다.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT_DIR = path.resolve(process.cwd(), 'extension/icons')
const SIZES = [16, 48, 128]

// CRC32 테이블 생성 (PNG 청크 체크섬용)
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[n] = c >>> 0
}

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0 // filter: None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

function insideRoundedRect(x, y, rx, ry, rw, rh, radius) {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false
  const cx = Math.max(rx + radius, Math.min(x, rx + rw - radius))
  const cy = Math.max(ry + radius, Math.min(y, ry + rh - radius))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function sampleIconColor(u, v) {
  // 32x32 SVG 좌표계로 매핑
  const x = u * 32
  const y = v * 32

  if (!insideRoundedRect(x, y, 0, 0, 32, 32, 8)) {
    return [0, 0, 0, 0]
  }

  // 은은한 파랑-인디고 대각선 그라데이션 (#3b82f6 -> #2563eb -> #4338ca)
  const t = Math.min(1, Math.max(0, (u + v) / 2))
  let r = Math.round(59 + (67 - 59) * t)
  let g = Math.round(130 + (56 - 130) * t)
  let b = Math.round(246 + (202 - 246) * t)

  const tiles = [
    { x: 7, y: 7, alpha: 1.0 },
    { x: 18, y: 7, alpha: 0.82 },
    { x: 7, y: 18, alpha: 0.82 },
    { x: 18, y: 18, alpha: 1.0 },
  ]

  for (const tile of tiles) {
    if (insideRoundedRect(x, y, tile.x, tile.y, 7, 7, 2)) {
      r = Math.round(r * (1 - tile.alpha) + 255 * tile.alpha)
      g = Math.round(g * (1 - tile.alpha) + 255 * tile.alpha)
      b = Math.round(b * (1 - tile.alpha) + 255 * tile.alpha)
      break
    }
  }

  return [r, g, b, 255]
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const samples = 4 // 4x4 슈퍼샘플링 안티앨리어싱
  const invSamples = 1 / (samples * samples)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sr = 0
      let sg = 0
      let sb = 0
      let sa = 0

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = (x + (sx + 0.5) / samples) / size
          const v = (y + (sy + 0.5) / samples) / size
          const [r, g, b, a] = sampleIconColor(u, v)
          sr += r * (a / 255)
          sg += g * (a / 255)
          sb += b * (a / 255)
          sa += a
        }
      }

      const avgA = sa * invSamples
      const offset = (y * size + x) * 4
      if (avgA > 0.5) {
        const factor = 255 / avgA
        rgba[offset] = Math.min(255, Math.round(sr * invSamples * factor))
        rgba[offset + 1] = Math.min(255, Math.round(sg * invSamples * factor))
        rgba[offset + 2] = Math.min(255, Math.round(sb * invSamples * factor))
        rgba[offset + 3] = Math.min(255, Math.round(avgA))
      }
    }
  }

  return encodePng(size, size, rgba)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const filePath = path.join(OUT_DIR, `icon-${size}.png`)
  fs.writeFileSync(filePath, renderIcon(size))
  console.log(`Generated ${filePath} (${size}x${size})`)
}
