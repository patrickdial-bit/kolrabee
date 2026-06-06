'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadJobPhoto, getCurrentPosition } from '@/lib/uploadPhoto'
import { getPhotoFullUrl, updatePhotoMeta, deletePhoto } from '@/lib/photo-actions'
import { PHOTO_TAGS, type PhotoWithUrl } from '@/lib/types'

type Tile = PhotoWithUrl & {
  key: string
  uploadStatus?: 'uploading' | 'error'
  localPreview?: string // object URL for optimistic thumb while uploading
}

interface ProjectPhotosProps {
  projectId: string
  tenantId: string
  initialPhotos: PhotoWithUrl[]
  canDelete: boolean
  currentUserId: string
}

function formatTakenAt(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ProjectPhotos({
  projectId,
  tenantId,
  initialPhotos,
  canDelete,
  currentUserId,
}: ProjectPhotosProps) {
  const [tiles, setTiles] = useState<Tile[]>(() =>
    initialPhotos.map((p) => ({ ...p, key: p.id })),
  )
  const [openKey, setOpenKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const open = openKey ? tiles.find((t) => t.key === openKey) ?? null : null

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      const files = Array.from(fileList)

      // Seed optimistic tiles immediately so the grid reacts instantly.
      const seeded: Tile[] = files.map((file) => ({
        key: crypto.randomUUID(),
        id: '',
        tenant_id: tenantId,
        project_id: projectId,
        uploaded_by: currentUserId,
        storage_path: '',
        thumb_path: '',
        taken_at: null,
        lat: null,
        lng: null,
        caption: null,
        tags: [],
        width: null,
        height: null,
        bytes: null,
        created_at: new Date().toISOString(),
        thumb_url: null,
        uploader_name: 'You',
        uploadStatus: 'uploading',
        localPreview: URL.createObjectURL(file),
      }))
      setTiles((prev) => [...seeded, ...prev])

      // Request GPS once and reuse for the whole batch (fail soft).
      const { lat, lng } = await getCurrentPosition()

      await Promise.all(
        files.map(async (file, i) => {
          const key = seeded[i].key
          try {
            const photo = await uploadJobPhoto({ file, tenantId, projectId, lat, lng })
            setTiles((prev) =>
              prev.map((t) =>
                t.key === key
                  ? { ...photo, key, uploadStatus: undefined, localPreview: seeded[i].localPreview }
                  : t,
              ),
            )
          } catch (err) {
            console.error('Photo upload failed', err)
            setTiles((prev) =>
              prev.map((t) => (t.key === key ? { ...t, uploadStatus: 'error' } : t)),
            )
            toast.error('A photo failed to upload. Tap it to retry.')
          }
        }),
      )
    },
    [projectId, tenantId, currentUserId],
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset so selecting the same file again re-triggers change.
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeTile = (key: string) =>
    setTiles((prev) => prev.filter((t) => t.key !== key))

  const patchTile = (key: string, patch: Partial<Tile>) =>
    setTiles((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Jobsite Photos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {tiles.length === 0
              ? 'Capture progress right from your phone.'
              : `${tiles.filter((t) => !t.uploadStatus).length} photo${
                  tiles.filter((t) => !t.uploadStatus).length === 1 ? '' : 's'
                }`}
          </p>
        </div>
      </div>

      {/* Large, single capture button — opens the rear camera on mobile and
          allows grabbing several shots in one go. */}
      <label className="flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-ember/40 bg-ember-light/40 px-4 py-6 cursor-pointer hover:bg-ember-light transition-colors">
        <svg className="h-8 w-8 text-ember" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        <span className="text-sm font-semibold text-gray-900">Take / Add Photos</span>
        <span className="text-xs text-gray-500">Auto-filed to this job with time + location</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={onInputChange}
          className="hidden"
        />
      </label>

      {tiles.length > 0 && (
        <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {tiles.map((tile) => {
            const src = tile.localPreview ?? tile.thumb_url ?? undefined
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => !tile.uploadStatus && setOpenKey(tile.key)}
                className="relative aspect-square overflow-hidden rounded-md bg-gray-100 group focus:outline-none focus:ring-2 focus:ring-ember"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={tile.caption ?? 'Jobsite photo'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gray-200" />
                )}

                {tile.uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-[10px] font-medium text-white">Uploading…</span>
                  </div>
                )}
                {tile.uploadStatus === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-900/60">
                    <span className="text-[10px] font-medium text-white">Failed</span>
                  </div>
                )}
                {!tile.uploadStatus && tile.tags.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                    {tile.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-black/55 px-1 text-[9px] font-medium text-white capitalize"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {open && !open.uploadStatus && (
        <Lightbox
          tile={open}
          canEdit={canDelete || open.uploaded_by === currentUserId}
          canDelete={canDelete}
          onClose={() => setOpenKey(null)}
          onPatch={(patch) => patchTile(open.key, patch)}
          onDeleted={() => {
            removeTile(open.key)
            setOpenKey(null)
          }}
        />
      )}
    </div>
  )
}

function Lightbox({
  tile,
  canEdit,
  canDelete,
  onClose,
  onPatch,
  onDeleted,
}: {
  tile: Tile
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onPatch: (patch: Partial<Tile>) => void
  onDeleted: () => void
}) {
  const [fullUrl, setFullUrl] = useState<string | null>(null)
  const [loadingFull, setLoadingFull] = useState(true)
  const [caption, setCaption] = useState(tile.caption ?? '')
  const [tags, setTags] = useState<string[]>(tile.tags)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch the full-size signed URL on open (egress: full-size only here).
  useEffect(() => {
    let cancelled = false
    getPhotoFullUrl(tile.id).then((res) => {
      if (cancelled) return
      setFullUrl(res.url ?? tile.thumb_url ?? null)
      setLoadingFull(false)
    })
    return () => {
      cancelled = true
    }
  }, [tile.id, tile.thumb_url])

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const dirty = caption !== (tile.caption ?? '') || tags.join(',') !== tile.tags.join(',')

  const handleSave = async () => {
    setSaving(true)
    const res = await updatePhotoMeta(tile.id, { caption, tags })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    onPatch({ caption: caption.trim() || null, tags })
    toast.success('Saved')
  }

  const handleDelete = async () => {
    if (!confirm('Delete this photo? This removes it for everyone.')) return
    setDeleting(true)
    const res = await deletePhoto(tile.id)
    setDeleting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    onDeleted()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-center bg-black" style={{ minHeight: 200 }}>
          {loadingFull ? (
            <span className="py-16 text-sm text-gray-300">Loading…</span>
          ) : fullUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fullUrl} alt={caption || 'Jobsite photo'} className="max-h-[55vh] w-auto object-contain" />
          ) : (
            <span className="py-16 text-sm text-gray-300">Image unavailable</span>
          )}
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{tile.uploader_name}</span>
            {formatTakenAt(tile.taken_at) && (
              <>
                <span>&middot;</span>
                <span>{formatTakenAt(tile.taken_at)}</span>
              </>
            )}
            {tile.lat != null && tile.lng != null && (
              <>
                <span>&middot;</span>
                <a
                  href={`https://maps.google.com/?q=${tile.lat},${tile.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ember hover:underline"
                >
                  View location
                </a>
              </>
            )}
          </div>

          {canEdit ? (
            <>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption…"
                rows={2}
                className="mt-3 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PHOTO_TAGS.map((tag) => {
                  const active = tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        active
                          ? 'bg-ember text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                {canDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="inline-flex items-center rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              {caption && <p className="mt-3 text-sm text-gray-900">{caption}</p>}
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
