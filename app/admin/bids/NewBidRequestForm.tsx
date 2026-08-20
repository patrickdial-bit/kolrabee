'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createBidRequest } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember/90 disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Create draft'}
    </button>
  )
}

export default function NewBidRequestForm() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState(createBidRequest, null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember/90"
      >
        + New Bid Request
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-4 w-full rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Title *</span>
          <input name="title" required placeholder="Westerville HOA — mill & overlay"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Site address</span>
          <input name="site_address" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Trade</span>
          <input name="trade" placeholder="asphalt" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Bids due</span>
          <input name="bids_due_at" type="datetime-local" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Target start</span>
          <input name="target_start" type="date" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Target end</span>
          <input name="target_end" type="date" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Visibility mode</span>
          <select name="visibility_mode" defaultValue="blind" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="blind">Blind (default)</option>
            <option value="blind_with_count">Blind with bidder count</option>
            <option value="open_low">Open low bid</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Internal budget ($, never shown to subs)</span>
          <input name="internal_budget" type="number" step="0.01" min="0" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Scope narrative</span>
          <textarea name="scope_narrative" rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton />
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
