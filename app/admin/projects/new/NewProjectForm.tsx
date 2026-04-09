'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { createProject } from './actions'
import GuidedTour, { type TourStep } from '@/components/GuidedTour'
import DatePicker from '@/components/DatePicker'

interface SelectedFile {
  file: File
  name: string
}

export default function NewProjectForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files).map(f => ({ file: f, name: f.name }))
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    for (const f of newFiles) {
      if (!allowed.includes(f.file.type)) {
        setError('Only PDF, JPG, and PNG files are allowed.')
        return
      }
      if (f.file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB.')
        return
      }
    }
    setSelectedFiles(prev => {
      const combined = [...prev, ...newFiles]
      if (combined.length > 3) {
        setError('Maximum 3 files allowed.')
        return prev
      }
      setError(null)
      return combined
    })
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      // Upload files to Supabase storage first (client-side)
      if (selectedFiles.length > 0) {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const uploadedFiles: Array<{ name: string; path: string; size: number; type: string }> = []

        for (const sf of selectedFiles) {
          const path = `uploads/projects/${Date.now()}-${sf.file.name}`
          const { error: uploadError } = await supabase.storage.from('documents').upload(path, sf.file)
          if (uploadError) {
            setError(`Failed to upload ${sf.name}.`)
            return
          }
          uploadedFiles.push({ name: sf.name, path, size: sf.file.size, type: sf.file.type })
        }

        formData.set('attachments_json', JSON.stringify(uploadedFiles))
      }

      const result = await createProject(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  const newProjectTourSteps: TourStep[] = [
    {
      target: '#customer_name',
      title: 'Customer Name',
      content: 'Enter the customer or property name. This is how the project will appear in your dashboard.',
      placement: 'bottom',
    },
    {
      target: '#payout_amount',
      title: 'Payout Amount',
      content: 'The dollar amount you\'ll pay the subcontractor for this project. They\'ll see this when they receive the invite.',
      placement: 'bottom',
    },
    {
      target: '#work_order_link',
      title: 'Work Order Link',
      content: 'Paste a link to the work order from any system — your CRM, Slack, Google Docs, or any website. Subs can click it to view details.',
      placement: 'bottom',
    },
    {
      target: '#companycam_link',
      title: 'Photo Repository',
      content: 'Link to project photos — Google Drive, Dropbox, CompanyCam, or any photo sharing service.',
      placement: 'bottom',
    },
    {
      target: '#notes',
      title: 'Notes for Subcontractor',
      content: 'These notes are visible to the subcontractor. Use them for job-specific instructions or details.',
      placement: 'top',
    },
    {
      target: '#admin_notes',
      title: 'Internal Admin Notes',
      content: 'These notes are only visible to you (the admin). Use them for internal tracking info that subs shouldn\'t see.',
      placement: 'top',
    },
  ]

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h1>

        {error && (
          <div className="mb-4 rounded-md bg-amber-50 p-4">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="job_number" className="block text-sm font-medium text-gray-700 mb-1">
                Project Number / ID
              </label>
              <input type="text" id="job_number" name="job_number"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                placeholder="Enter Job Number / ID" />
            </div>

            <div>
              <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-amber-500">*</span>
              </label>
              <input type="text" id="customer_name" name="customer_name" required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                placeholder="e.g. John Smith" />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Project Site Address <span className="text-amber-500">*</span>
            </label>
            <input type="text" id="address" name="address" required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
              placeholder="Enter full address (street, city, state, zip)" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                Project Start Date
              </label>
              <DatePicker id="start_date" name="start_date" />
            </div>

            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input type="time" id="start_time" name="start_time"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="payout_amount" className="block text-sm font-medium text-gray-700 mb-1">
                Project Payout ($ Amount) <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" id="payout_amount" name="payout_amount" required min="0" step="0.01"
                  className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                  placeholder="0.00" />
              </div>
            </div>

            <div>
              <label htmlFor="estimated_labor_hours" className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Labor Hours
              </label>
              <input type="number" id="estimated_labor_hours" name="estimated_labor_hours" min="0" step="0.01"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
                placeholder="Enter Estimated Labor Hours" />
            </div>
          </div>

          <div>
            <label htmlFor="work_order_link" className="block text-sm font-medium text-gray-700 mb-1">
              Work Order Link
            </label>
            <input type="text" id="work_order_link" name="work_order_link"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
              placeholder="Paste any link — CRM, Slack, Google Docs, etc." />
          </div>

          <div>
            <label htmlFor="companycam_link" className="block text-sm font-medium text-gray-700 mb-1">
              Photo Repository Link
            </label>
            <input type="text" id="companycam_link" name="companycam_link"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
              placeholder="Paste any link — Google Drive, Dropbox, CompanyCam, etc." />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes from Admin
            </label>
            <textarea id="notes" name="notes" rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
              placeholder="Enter Notes From Admin" />
          </div>

          <div>
            <label htmlFor="admin_notes" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notes (Internal)
            </label>
            <textarea id="admin_notes" name="admin_notes" rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm"
              placeholder="Internal notes, not visible to subs..." />
          </div>

          {/* Job Documents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Documents
            </label>
            <p className="text-xs text-gray-500 mb-2">Attach up to 3 files (PDF, JPG, PNG). Max 10MB each.</p>
            {selectedFiles.length > 0 && (
              <ul className="mb-2 space-y-1">
                {selectedFiles.map((sf, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-gray-700">{sf.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-xs text-amber-600 hover:text-amber-700">Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {selectedFiles.length < 3 && (
              <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add File
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={isPending}
              className="inline-flex items-center rounded-md bg-ember px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {isPending ? 'Creating...' : 'Create Project'}
            </button>
            <Link href="/admin/dashboard"
              className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Guided tour for first-time users */}
      <GuidedTour steps={newProjectTourSteps} tourKey="admin-project-new" />
    </>
  )
}
