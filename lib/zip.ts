// Browser-only download helpers. Imported by client components; call only in
// the browser (they use fetch + DOM + URL.createObjectURL).

export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const blob = await res.blob()
  triggerDownload(blob, filename)
}

export async function zipAndDownload(
  items: { url: string; filename: string }[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  let ok = 0
  let failed = 0
  // Sequential to bound memory/concurrency on large galleries.
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    try {
      const res = await fetch(it.url)
      if (!res.ok) throw new Error(String(res.status))
      zip.file(dedupeName(zip, it.filename), await res.blob())
      ok++
    } catch {
      failed++
    }
    onProgress?.(i + 1, items.length)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  triggerDownload(content, zipName)
  return { ok, failed }
}

function dedupeName(zip: any, name: string): string {
  if (!zip.file(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let i = 2
  while (zip.file(`${base}-${i}${ext}`)) i++
  return `${base}-${i}${ext}`
}

function triggerDownload(blob: Blob, filename: string): void {
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objUrl)
}
