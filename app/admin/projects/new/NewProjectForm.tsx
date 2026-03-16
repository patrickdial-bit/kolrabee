'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { createProject } from './actions'

export default function NewProjectForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await createProject(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="job_number" className="block text-sm font-medium text-gray-700 mb-1">
                Job Number
              </label>
              <input
                type="text"
                id="job_number"
                name="job_number"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g. JOB-001"
              />
            </div>

            <div>
              <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                placeholder="e.g. John Smith"
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="address"
              name="address"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g. 123 Main St, Springfield, IL 62701"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="payout_amount" className="block text-sm font-medium text-gray-700 mb-1">
                Payout Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  id="payout_amount"
                  name="payout_amount"
                  required
                  min="0"
                  step="0.01"
                  className="block w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="companycam_link" className="block text-sm font-medium text-gray-700 mb-1">
              CompanyCam Link
            </label>
            <input
              type="url"
              id="companycam_link"
              name="companycam_link"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="https://app.companycam.com/..."
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="Visible to subcontractors..."
            />
          </div>

          <div>
            <label htmlFor="admin_notes" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notes
            </label>
            <textarea
              id="admin_notes"
              name="admin_notes"
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              placeholder="Internal notes, not visible to subs..."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Creating...' : 'Create Project'}
            </button>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
