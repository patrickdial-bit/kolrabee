'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/AppShell'
import Tooltip from '@/components/Tooltip'
import type { CrewMember } from '@/lib/types'
import { addCrewMember, updateCrewMember, archiveCrewMember, restoreCrewMember } from './actions'

interface Props {
  slug: string
  tenantName: string
  subName: string
  members: CrewMember[]
}

export default function CrewPageClient({ slug, tenantName, subName, members }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const active = members.filter((m) => m.status === 'active')
  const archived = members.filter((m) => m.status === 'archived')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.')
      return
    }
    startTransition(async () => {
      const result = await addCrewMember(slug, firstName, lastName, phone)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      setFirstName('')
      setLastName('')
      setPhone('')
      toast.success('Crew member added.')
      router.refresh()
    })
  }

  function startEdit(m: CrewMember) {
    setEditingId(m.id)
    setEditFirst(m.first_name)
    setEditLast(m.last_name)
    setEditPhone(m.phone ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const result = await updateCrewMember(slug, id, {
        first_name: editFirst,
        last_name: editLast,
        phone: editPhone,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      setEditingId(null)
      toast.success('Crew member updated.')
      router.refresh()
    })
  }

  function handleArchive(id: string, name: string) {
    if (!confirm(`Archive ${name}? They will no longer appear on job clock-in lists. Historical hours are preserved.`)) {
      return
    }
    startTransition(async () => {
      const result = await archiveCrewMember(slug, id)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Crew member archived.')
      router.refresh()
    })
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreCrewMember(slug, id)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Crew member restored.')
      router.refresh()
    })
  }

  return (
    <AppShell variant="sub" slug={slug} tenantName={tenantName} subName={subName} isCrewLeader>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Crew</h1>
          <p className="mt-1 text-sm text-gray-600">
            Crew members do not get a login. You clock them in and out from each job.
          </p>
        </div>

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Add a crew member</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              required
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Tooltip text="Add this worker to your crew so you can clock them in on jobs.">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Adding…' : 'Add to crew'}
              </button>
            </Tooltip>
          </div>
        </form>

        {/* Active list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Active crew{active.length ? ` (${active.length})` : ''}
          </h2>
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Add your first crew member. They will not get a login — only you can clock them in/out.
            </div>
          ) : (
            <ul className="space-y-2">
              {active.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  {editingId === m.id ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        value={editFirst}
                        onChange={(e) => setEditFirst(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={editLast}
                        onChange={(e) => setEditLast(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <div className="sm:col-span-3 flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(m.id)}
                          disabled={isPending}
                          className="rounded-md bg-ember px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {m.first_name} {m.last_name}
                        </p>
                        {m.phone && (
                          <p className="text-xs text-gray-500">{m.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip text="Update this crew member's name or phone." position="left">
                          <button
                            onClick={() => startEdit(m)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        </Tooltip>
                        <Tooltip text="Remove from clock-in lists. Past hours are kept." position="left">
                          <button
                            onClick={() => handleArchive(m.id, `${m.first_name} ${m.last_name}`)}
                            disabled={isPending}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {archived.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Archived ({archived.length})
            </h2>
            <ul className="space-y-2">
              {archived.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm text-gray-700">
                      {m.first_name} {m.last_name}
                    </p>
                    {m.phone && <p className="text-xs text-gray-500">{m.phone}</p>}
                  </div>
                  <Tooltip text="Bring this member back so they show up on clock-in lists again." position="left">
                    <button
                      onClick={() => handleRestore(m.id)}
                      disabled={isPending}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/80 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  )
}
