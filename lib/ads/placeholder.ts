import zlib from 'zlib'

// Minimal solid-color PNG encoder. Used as a deterministic fallback for image
// generation when GEMINI_API_KEY is not configured, so the full generate ->
// review -> export flow works without live API access (prototype DoD).

const CRC_TABLE: number[] = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [30, 58, 138]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

// Generate a solid-color square PNG. Solid fills compress to a few KB via deflate.
export function solidColorPng(hex: string, size = 1080): Buffer {
  const [r, g, b] = hexToRgb(hex)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const rowBytes = size * 3
  const raw = Buffer.alloc((rowBytes + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }

  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Pick a per-variant tint derived from a base brand color so the 20 placeholder
// concepts are visually distinguishable in the review grid.
export function tintFor(baseHex: string, index: number): string {
  const [r, g, b] = hexToRgb(baseHex)
  const shift = (v: number, by: number) => Math.max(0, Math.min(255, v + by))
  const by = ((index % 5) - 2) * 28
  const to2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to2(shift(r, by))}${to2(shift(g, Math.floor(by / 2)))}${to2(shift(b, -by))}`
}
