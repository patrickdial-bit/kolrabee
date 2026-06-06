// Zero-dependency, client-side image compression via <canvas>.
//
// Crews shoot 30-50 photos/job at 3-5MB each. Uncompressed that's 150MB+ per
// job through the network — slow uploads, storage bloat, and Supabase egress
// costs. Compressing to ~500KB on the device cuts that ~85% and makes uploads
// feel instant. We hand-roll with <canvas> (per the spec's zero-deps option)
// to avoid shipping an extra library.
//
// Strategy: downscale to a max dimension, then binary-search JPEG quality until
// the encoded blob fits under the byte budget.

export type CompressResult = {
  blob: Blob
  width: number
  height: number
}

type CompressOptions = {
  maxSizeMB: number
  maxWidthOrHeight: number
}

// Decode a File/Blob into an ImageBitmap (fast path) or HTMLImageElement.
async function loadImage(file: Blob): Promise<{
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  width: number
  height: number
  close: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation: 'from-image' applies EXIF rotation so portrait shots
    // aren't filed sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    return {
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode image'))
      el.src = url
    })
    return {
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => {},
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encode failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export async function compressImage(file: File, opts: CompressOptions): Promise<CompressResult> {
  const maxBytes = opts.maxSizeMB * 1024 * 1024
  const source = await loadImage(file)

  try {
    // Scale down so the longest edge fits maxWidthOrHeight (never upscale).
    const scale = Math.min(1, opts.maxWidthOrHeight / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage = ctx.drawImage.bind(ctx)
    source.draw(ctx, width, height)

    // Binary-search the JPEG quality that lands just under the byte budget.
    let lo = 0.4
    let hi = 0.92
    let best = await canvasToBlob(canvas, hi)

    if (best.size > maxBytes) {
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        const candidate = await canvasToBlob(canvas, mid)
        if (candidate.size > maxBytes) {
          hi = mid
        } else {
          best = candidate
          lo = mid
        }
      }
      // Final pull toward the lowest tried quality if still over budget.
      if (best.size > maxBytes) {
        const floor = await canvasToBlob(canvas, lo)
        if (floor.size < best.size) best = floor
      }
    }

    return { blob: best, width, height }
  } finally {
    source.close()
  }
}
