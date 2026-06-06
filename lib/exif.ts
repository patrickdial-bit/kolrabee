// Minimal, zero-dependency EXIF reader. We only need DateTimeOriginal (when the
// shutter actually fired) so the gallery timeline is accurate even if a crew
// uploads photos hours later. Returns null on anything unexpected; callers fall
// back to file.lastModified or the client clock.

function readDateTimeOriginal(view: DataView): string | null {
  // JPEG starts with SOI 0xFFD8. Walk APPn markers looking for APP1 "Exif".
  if (view.getUint16(0) !== 0xffd8) return null

  let offset = 2
  const length = view.byteLength
  while (offset < length) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    const size = view.getUint16(offset + 2)
    if (marker === 0xe1) {
      // APP1 — check for "Exif\0\0" header.
      const exifStart = offset + 4
      if (
        view.getUint32(exifStart) === 0x45786966 && // "Exif"
        view.getUint16(exifStart + 4) === 0x0000
      ) {
        return parseTiff(view, exifStart + 6)
      }
    }
    if (size <= 0) break
    offset += 2 + size
  }
  return null
}

function parseTiff(view: DataView, tiffStart: number): string | null {
  const byteOrder = view.getUint16(tiffStart)
  const little = byteOrder === 0x4949 // 'II' = little-endian, 'MM' = big-endian
  if (!little && byteOrder !== 0x4d4d) return null

  const u16 = (o: number) => view.getUint16(o, little)
  const u32 = (o: number) => view.getUint32(o, little)

  const ifd0 = tiffStart + u32(tiffStart + 4)

  // Find the Exif sub-IFD pointer (tag 0x8769) in IFD0.
  const exifPtr = findTag(view, ifd0, tiffStart, 0x8769, u16, u32)
  if (exifPtr == null) return null

  // DateTimeOriginal is tag 0x9003, an ASCII string "YYYY:MM:DD HH:MM:SS".
  const exifIfd = tiffStart + exifPtr
  const strOffset = findTagAscii(view, exifIfd, tiffStart, 0x9003, u16, u32)
  if (strOffset == null) return null

  let s = ''
  for (let i = 0; i < 19; i++) {
    const c = view.getUint8(strOffset + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  // "2024:06:01 14:30:00" -> ISO. Treat as local time (EXIF carries no zone).
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h, mi, se] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))
  return isNaN(date.getTime()) ? null : date.toISOString()
}

function eachEntry(
  view: DataView,
  ifdStart: number,
  u16: (o: number) => number,
  fn: (tag: number, type: number, count: number, valueOffset: number) => boolean,
) {
  const count = u16(ifdStart)
  for (let i = 0; i < count; i++) {
    const entry = ifdStart + 2 + i * 12
    const tag = u16(entry)
    const type = u16(entry + 2)
    if (fn(tag, type, entry, entry + 8)) return
  }
}

function findTag(
  view: DataView,
  ifdStart: number,
  _tiffStart: number,
  wantTag: number,
  u16: (o: number) => number,
  u32: (o: number) => number,
): number | null {
  let found: number | null = null
  eachEntry(view, ifdStart, u16, (tag, _type, _entry, valueOffset) => {
    if (tag === wantTag) {
      found = u32(valueOffset)
      return true
    }
    return false
  })
  return found
}

function findTagAscii(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  wantTag: number,
  u16: (o: number) => number,
  u32: (o: number) => number,
): number | null {
  let found: number | null = null
  eachEntry(view, ifdStart, u16, (tag, _type, _entry, valueOffset) => {
    if (tag === wantTag) {
      found = tiffStart + u32(valueOffset)
      return true
    }
    return false
  })
  return found
}

export async function readExifTakenAt(file: File): Promise<string | null> {
  try {
    // EXIF lives in the first APP1 segment; 128KB is plenty.
    const slice = file.slice(0, 128 * 1024)
    const buffer = await slice.arrayBuffer()
    return readDateTimeOriginal(new DataView(buffer))
  } catch {
    return null
  }
}
