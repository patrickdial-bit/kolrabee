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

// Build a structured backup ZIP: files are grouped into named subfolders (e.g.
// photos/, documents/) under a single job folder, plus optional text files (a
// README/manifest) at the folder root. This mirrors the layout the cloud
// destinations (Google Drive/Dropbox/OneDrive) will create per job, so the same
// payload feeds both local ZIP and future provider uploads.
export async function zipBackupAndDownload(
  args: {
    rootFolder: string
    groups: { folder: string; items: { url: string; filename: string }[] }[]
    textFiles?: { filename: string; content: string }[]
  },
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const root = zip.folder(args.rootFolder) ?? zip

  for (const tf of args.textFiles ?? []) {
    root.file(tf.filename, tf.content)
  }

  const total = args.groups.reduce((n, g) => n + g.items.length, 0)
  let done = 0
  let ok = 0
  let failed = 0
  onProgress?.(0, total)

  for (const group of args.groups) {
    if (group.items.length === 0) continue
    const sub = root.folder(group.folder) ?? root
    const used = new Set<string>()
    // Sequential to bound memory/concurrency on large jobs.
    for (const it of group.items) {
      try {
        const res = await fetch(it.url)
        if (!res.ok) throw new Error(String(res.status))
        sub.file(dedupeIn(used, it.filename), await res.blob())
        ok++
      } catch {
        failed++
      }
      done++
      onProgress?.(done, total)
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  triggerDownload(content, zipName)
  return { ok, failed }
}

function dedupeIn(used: Set<string>, name: string): string {
  if (!used.has(name)) { used.add(name); return name }
  const dot = name.lastIndexOf('.')
  const base = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let i = 2
  while (used.has(`${base}-${i}${ext}`)) i++
  const out = `${base}-${i}${ext}`
  used.add(out)
  return out
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
