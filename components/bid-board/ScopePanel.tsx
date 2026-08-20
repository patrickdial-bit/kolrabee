'use client'

// Side-by-side scope entry (spec §10 Gate 0.1): takeoff image on the left with
// zoom/pan, quantity entry on the right. Never make someone tab between a
// Drive tab and a form — that's where digits get dropped. Scope entry is
// locked until an internal takeoff is attached.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TakeoffViewer from './TakeoffViewer'
import {
  addScopeGroup,
  addScopeItem,
  deleteScopeGroup,
  deleteScopeItem,
  importScope,
} from '@/app/admin/bids/[id]/scope-actions'
import { decodeScopeCode, parseScopeCode } from '@/lib/bid-board/scope-code'
import {
  UOMS,
  type BidAttachment,
  type BidRequest,
  type BidScopeGroup,
  type BidScopeItem,
  type GroupType,
  type ScopeCodeMaterial,
  type Uom,
} from '@/lib/bid-board/types'

const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  base_bid: 'Base bid',
  option: 'Option',
  add_item: 'Add item',
  add_option: 'Add option',
}

type Props = {
  request: BidRequest
  groups: BidScopeGroup[]
  items: BidScopeItem[]
  attachments: BidAttachment[]
  materials: ScopeCodeMaterial[]
  signedUrls: Record<string, string>
}

export default function ScopePanel({ request, groups, items, attachments, materials, signedUrls }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [gate1Errors, setGate1Errors] = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')

  const editable = request.status === 'draft'
  const takeoff = attachments.find(
    (a) => a.attachment_role === 'takeoff_internal' && a.kind === 'upload' && signedUrls[a.id]
  )

  const itemsByGroup = useMemo(() => {
    const map = new Map<string, BidScopeItem[]>()
    for (const item of items) {
      const list = map.get(item.bid_scope_group_id) ?? []
      list.push(item)
      map.set(item.bid_scope_group_id, list)
    }
    return map
  }, [items])

  const handleImport = async () => {
    setError(null)
    setGate1Errors([])
    const result = await importScope(request.id, importJson)
    if (result?.error) {
      setError(result.error)
      setGate1Errors(result.gate1 ?? [])
      return
    }
    setShowImport(false)
    setImportJson('')
    router.refresh()
  }

  // Gate 0.1: takeoff must be attached before scope entry unlocks.
  if (!takeoff) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-800">
        <strong>Scope entry is locked.</strong> Attach the internal takeoff first (Package tab) —
        quantities are keyed against the image side-by-side, never from memory or a second tab.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!editable && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Scope is frozen — this request is {request.status}. Changes require a new bid round (addendum).
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">{error}</p>
          {gate1Errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {gate1Errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: the takeoff, always in view while keying quantities */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <TakeoffViewer
            src={signedUrls[takeoff.id]}
            alt={takeoff.label ?? 'Internal takeoff'}
            downloadUrl={signedUrls[takeoff.id]}
            className="h-[540px]"
          />
        </div>

        {/* Right: groups + items */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-forge">Scope groups</h2>
            {editable && (
              <button
                onClick={() => setShowImport((s) => !s)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {showImport ? 'Close import' : 'Import from scoping system'}
              </button>
            )}
          </div>

          {showImport && (
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                Paste the nested JSON payload (<code>{'{ groups: [...] }'}</code>). Gate 1 rejects
                bad units, unbalanced depths, and stale codes outright. Re-import updates in place
                via <code>source_ref</code>.
              </p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded-md border border-gray-300 p-2 font-mono text-xs"
                placeholder='{"groups":[{"source_ref":"mm-1","group_type":"base_bid","label":"BASE BID","scope_code":"E6S4A2","items":[{"source_ref":"mm-1-1","description":"Excavate 6\"","qty":1200,"uom":"SY"}]}]}'
              />
              <button
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="mt-2 rounded-md bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember/90 disabled:opacity-50"
              >
                Validate & import
              </button>
            </div>
          )}

          {groups.length === 0 && (
            <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
              No scope yet. Import from the scoping system or add a base bid group below.
            </p>
          )}

          {groups.map((group) => (
            <GroupCard
              key={group.id}
              request={request}
              group={group}
              groups={groups}
              items={itemsByGroup.get(group.id) ?? []}
              materials={materials}
              editable={editable}
              onError={setError}
            />
          ))}

          {editable && <AddGroupForm request={request} groups={groups} onError={setError} />}
        </div>
      </div>
    </div>
  )
}

function ScopeCodeBadge({ code, materials }: { code: string; materials: ScopeCodeMaterial[] }) {
  const parsed = parseScopeCode(code)
  const layers = decodeScopeCode(parsed, materials)
  return (
    <div className="mt-2">
      {/* The raw code is a badge for our people; subs get the decoded stack. */}
      <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-100">{code}</span>
      {!parsed.ok ? (
        <p className="mt-1 text-xs text-red-600">{parsed.error}</p>
      ) : (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="py-0.5 pr-2 font-medium">#</th>
              <th className="py-0.5 pr-2 font-medium">Material</th>
              <th className="py-0.5 font-medium">Depth</th>
            </tr>
          </thead>
          <tbody>
            {layers.map((layer, i) => (
              <tr key={i} className="text-gray-600">
                <td className="py-0.5 pr-2">{i + 1}</td>
                <td className="py-0.5 pr-2">
                  {layer.materialName}
                  {layer.spec && <span className="text-gray-400"> ({layer.spec})</span>}
                </td>
                <td className="py-0.5">{layer.depth !== null ? `${layer.depth}"` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function GroupCard({
  request,
  group,
  groups,
  items,
  materials,
  editable,
  onError,
}: {
  request: BidRequest
  group: BidScopeGroup
  groups: BidScopeGroup[]
  items: BidScopeItem[]
  materials: ScopeCodeMaterial[]
  editable: boolean
  onError: (e: string | null) => void
}) {
  const router = useRouter()
  const parent = group.parent_group_id ? groups.find((g) => g.id === group.parent_group_id) : null

  const handleDeleteGroup = async () => {
    if (!confirm(`Delete "${group.label}" and its items?`)) return
    onError(null)
    const result = await deleteScopeGroup(request.id, group.id)
    if (result?.error) onError(result.error)
    router.refresh()
  }

  const handleDeleteItem = async (itemId: string) => {
    onError(null)
    const result = await deleteScopeItem(request.id, itemId)
    if (result?.error) onError(result.error)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-forge">{group.label}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {GROUP_TYPE_LABELS[group.group_type]}
            </span>
            {parent && (
              <span className="text-xs text-gray-400">↳ under {parent.label}</span>
            )}
          </div>
          {group.description && <p className="mt-1 text-xs text-gray-500">{group.description}</p>}
          {group.scope_code && <ScopeCodeBadge code={group.scope_code} materials={materials} />}
        </div>
        {editable && (
          <button
            onClick={handleDeleteGroup}
            className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>

      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-gray-50">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-2">
                <div className="text-gray-700">{item.description}</div>
                {item.notes && <div className="text-xs text-amber-700">{item.notes}</div>}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-forge">
                {item.qty !== null ? Number(item.qty).toLocaleString() : '—'} {item.uom ?? ''}
              </td>
              {editable && (
                <td className="w-10 px-2 py-2 text-right">
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete item"
                    className="text-xs text-gray-300 hover:text-red-600"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-xs text-gray-400">No items yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {editable && <AddItemForm request={request} groupId={group.id} onError={onError} />}
    </div>
  )
}

function AddItemForm({
  request,
  groupId,
  onError,
}: {
  request: BidRequest
  groupId: string
  onError: (e: string | null) => void
}) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('')
  const [uom, setUom] = useState<Uom>('SY')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async () => {
    onError(null)
    setPending(true)
    const result = await addScopeItem(request.id, groupId, {
      description,
      qty: qty ? Number(qty) : null,
      uom,
      notes: notes || null,
    })
    setPending(false)
    if (result?.error) {
      onError(result.error)
      return
    }
    setDescription('')
    setQty('')
    setNotes('')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Line item description"
        className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
      />
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qty"
        type="number"
        step="0.01"
        min="0"
        className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
      />
      <select
        value={uom}
        onChange={(e) => setUom(e.target.value as Uom)}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
      >
        {UOMS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Field notes (water holds, truck turning…)"
        className="min-w-[120px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
      />
      <button
        onClick={submit}
        disabled={pending || !description.trim()}
        className="rounded-md bg-forge px-3 py-1.5 text-xs font-medium text-white hover:bg-forge/90 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  )
}

function AddGroupForm({
  request,
  groups,
  onError,
}: {
  request: BidRequest
  groups: BidScopeGroup[]
  onError: (e: string | null) => void
}) {
  const router = useRouter()
  const [groupType, setGroupType] = useState<GroupType>('base_bid')
  const [label, setLabel] = useState('')
  const [ordinal, setOrdinal] = useState('')
  const [parentId, setParentId] = useState('')
  const [scopeCode, setScopeCode] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)

  const needsParent = groupType === 'add_item' || groupType === 'add_option'
  const parentChoices = groups.filter((g) =>
    groupType === 'add_item'
      ? g.group_type === 'base_bid' || g.group_type === 'option'
      : g.group_type !== 'add_option'
  )

  const submit = async () => {
    onError(null)
    setPending(true)
    const result = await addScopeGroup(request.id, {
      group_type: groupType,
      label,
      ordinal: ordinal ? Number(ordinal) : null,
      parent_group_id: needsParent ? parentId || null : null,
      scope_code: scopeCode || null,
      description: description || null,
    })
    setPending(false)
    if (result?.error) {
      onError(result.error)
      return
    }
    setLabel('')
    setOrdinal('')
    setScopeCode('')
    setDescription('')
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add group</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={groupType}
          onChange={(e) => setGroupType(e.target.value as GroupType)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        >
          {(Object.entries(GROUP_TYPE_LABELS) as [GroupType, string][]).map(([value, l]) => (
            <option key={value} value={value}>{l}</option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Label — "BASE BID", "OPTION 1"'
          className="min-w-[140px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        />
        <input
          value={ordinal}
          onChange={(e) => setOrdinal(e.target.value)}
          placeholder="No."
          type="number"
          min="1"
          className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        />
        {needsParent && (
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="">Parent group…</option>
            {parentChoices.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        )}
        <input
          value={scopeCode}
          onChange={(e) => setScopeCode(e.target.value)}
          placeholder="Scope code (E6S4A2)"
          className="w-36 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Sub-facing description"
          className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        />
        <button
          onClick={submit}
          disabled={pending || !label.trim() || (needsParent && !parentId)}
          className="rounded-md bg-ember px-3 py-1.5 text-xs font-medium text-white hover:bg-ember/90 disabled:opacity-50"
        >
          Add group
        </button>
      </div>
    </div>
  )
}
