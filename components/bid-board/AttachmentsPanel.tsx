'use client'

// Bid package attachments (spec §3 bid_attachments): upload with role
// auto-detect from the SOP filename convention, role/visibility retagging,
// external links with the Drive-permission warning, takeoff viewer.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TakeoffViewer from './TakeoffViewer'
import {
  addExternalLink,
  recordAttachment,
  removeAttachment,
  updateAttachment,
} from '@/app/admin/bids/[id]/attachment-actions'
import {
  ATTACHMENT_ROLE_LABELS,
  type AttachmentRole,
  type BidAttachment,
  type BidRequest,
} from '@/lib/bid-board/types'

const ROLE_OPTIONS = Object.entries(ATTACHMENT_ROLE_LABELS) as [AttachmentRole, string][]

type Props = {
  request: BidRequest
  attachments: BidAttachment[]
  signedUrls: Record<string, string>
  tenantId: string
}

export default function AttachmentsPanel({ request, attachments, signedUrls, tenantId }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [viewerAttachment, setViewerAttachment] = useState<BidAttachment | null>(null)

  const takeoffs = attachments.filter((a) => a.attachment_role === 'takeoff_internal')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    for (const file of Array.from(files)) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowed.includes(file.type)) {
        setError(`${file.name}: only PDF, JPG, PNG, and WebP files are allowed.`)
        setUploading(false)
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name}: file size must be under 25MB.`)
        setUploading(false)
        return
      }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const path = `${tenantId}/bids/${request.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('bid-packages').upload(path, file)
      if (uploadError) {
        setError(`Failed to upload ${file.name}.`)
        setUploading(false)
        return
      }
      const result = await recordAttachment(request.id, {
        fileName: file.name,
        storagePath: path,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if (result?.error) {
        setError(result.error)
        setUploading(false)
        return
      }
    }
    setUploading(false)
    router.refresh()
    e.target.value = ''
  }

  const handleAddLink = async () => {
    setError(null)
    const result = await addExternalLink(request.id, linkUrl, linkLabel)
    if (result?.error) {
      setError(result.error)
      return
    }
    setLinkUrl('')
    setLinkLabel('')
    router.refresh()
  }

  const handleRoleChange = async (att: BidAttachment, role: AttachmentRole) => {
    setError(null)
    // Proposal takeoff is a sales asset — default it hidden when retagged.
    const fields: Parameters<typeof updateAttachment>[1] = { attachment_role: role }
    if (role === 'takeoff_proposal') fields.visible_to_subs = false
    const result = await updateAttachment(att.id, fields)
    if (result?.error) setError(result.error)
    router.refresh()
  }

  const handleVisibility = async (att: BidAttachment, visible: boolean) => {
    setError(null)
    const result = await updateAttachment(att.id, { visible_to_subs: visible })
    if (result?.error) setError(result.error)
    router.refresh()
  }

  const handleRemove = async (att: BidAttachment) => {
    if (!confirm(`Remove "${att.label}"?`)) return
    setError(null)
    const result = await removeAttachment(att.id)
    if (result?.error) setError(result.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {takeoffs.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>No internal takeoff attached.</strong> The takeoff is the authoritative scope
          record — scope entry stays locked until one is uploaded, and a request can&apos;t be sent
          without it. Name it <code className="rounded bg-amber-100 px-1">JobName - InternalTakeoff.png</code> and
          it will be tagged automatically.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember/90">
          {uploading ? 'Uploading…' : 'Upload files'}
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading}
            accept="application/pdf,image/jpeg,image/png,image/webp" />
        </label>
        <span className="text-xs text-gray-500">
          PDF, JPG, PNG, WebP · Takeoffs auto-detected from the SOP filename convention
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {viewerAttachment && signedUrls[viewerAttachment.id] && (
        <TakeoffViewer
          src={signedUrls[viewerAttachment.id]}
          alt={viewerAttachment.label ?? 'Takeoff'}
          downloadUrl={signedUrls[viewerAttachment.id]}
          className="h-[520px]"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Visible to subs</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {attachments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Nothing in the package yet.
                </td>
              </tr>
            )}
            {attachments.map((att) => (
              <tr key={att.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-forge">{att.label ?? '(unnamed)'}</div>
                  <div className="text-xs text-gray-500">
                    {att.kind === 'external_link'
                      ? att.external_url
                      : `${att.mime_type ?? ''}${att.size_bytes ? ` · ${(att.size_bytes / 1024 / 1024).toFixed(1)}MB` : ''}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={att.attachment_role}
                    onChange={(e) => handleRoleChange(att, e.target.value as AttachmentRole)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={att.visible_to_subs}
                    onChange={(e) => handleVisibility(att, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-ember"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {att.kind === 'upload' && signedUrls[att.id] && (
                      att.mime_type?.startsWith('image/') ? (
                        <button
                          onClick={() => setViewerAttachment(att)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          View
                        </button>
                      ) : (
                        <a
                          href={signedUrls[att.id]}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Open
                        </a>
                      )
                    )}
                    {att.kind === 'external_link' && att.external_url && (
                      <a
                        href={att.external_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Opens in a new tab — use a private window to test as an outsider"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Test as outsider
                      </a>
                    )}
                    <button
                      onClick={() => handleRemove(att)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-forge">Add external link</h3>
        <p className="mt-1 text-xs text-amber-700">
          Subs view attachments without a Google login. Confirm the Drive folder is set to
          “Anyone with the link — Viewer” before sending, then use “Test as outsider” in a
          private window.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            className="min-w-[240px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddLink}
            disabled={!linkUrl.trim()}
            className="rounded-md bg-forge px-4 py-2 text-sm font-medium text-white hover:bg-forge/90 disabled:opacity-50"
          >
            Add link
          </button>
        </div>
      </div>
    </div>
  )
}
