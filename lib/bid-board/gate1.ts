// Gate 1 — import-time hard blocks (spec: docs/bid-board-spec.md §10 Gate 1).
// These reject the payload outright; they never warn and never auto-convert.

import { parseScopeCode, checkDepthBalance } from './scope-code'
import { UOMS, type GroupType, type Uom } from './types'

export type ImportItem = {
  source_ref?: string | null
  description: string
  qty: number | null
  uom: string | null
  notes?: string | null
  sort_order?: number
}

export type ImportGroup = {
  source_ref?: string | null
  group_type: GroupType
  label: string
  ordinal?: number | null
  parent_source_ref?: string | null
  scope_code?: string | null
  description?: string | null
  sort_order?: number
  items: ImportItem[]
}

export type Gate1Error = {
  /** Which rule fired, for display grouping */
  rule: 'uom' | 'depth_balance' | 'code_item_consistency' | 'hierarchy' | 'positive_qty' | 'structure'
  group?: string
  item?: string
  message: string
}

const UOM_SET = new Set<string>(UOMS)

// Keyword families for code/item consistency (Gate 1 check 3).
const KEYWORDS: Record<string, RegExp> = {
  E: /excav|full[- ]depth|undercut|remov/i,
  A: /asphalt|overlay|surface|intermediate|448|301|paving|pave/i,
  S: /stone|aggregate|#2|304|base course|backfill/i,
}

export function validateUom(uom: string | null): string | null {
  if (uom === null || uom === '') return null
  if (uom === 'SF') {
    return 'SF rejected: MeasureMap defaults to square feet — change the project setting and re-export. Area quantities must be SY.'
  }
  if (uom === 'FT' || uom === 'LFT') {
    return `${uom} rejected: linear quantities must be LF.`
  }
  if (!UOM_SET.has(uom)) {
    return `Unknown unit "${uom}". Allowed: ${UOMS.join(', ')}.`
  }
  return null
}

/**
 * Run all Gate 1 checks over a full import payload. Returns [] when clean;
 * any entries mean the payload must be rejected outright.
 */
export function runGate1(groups: ImportGroup[]): Gate1Error[] {
  const errors: Gate1Error[] = []
  const byRef = new Map<string, ImportGroup>()
  for (const g of groups) {
    if (g.source_ref) byRef.set(g.source_ref, g)
  }

  const baseBids = groups.filter((g) => g.group_type === 'base_bid')
  if (baseBids.length !== 1) {
    errors.push({
      rule: 'hierarchy',
      message: `Exactly one base bid group is required (payload has ${baseBids.length}).`,
    })
  }

  for (const g of groups) {
    const gLabel = g.label || g.source_ref || '(unlabeled group)'

    // 4. Hierarchy constraints — surfaced legibly here, enforced again at DB level.
    const needsParent = g.group_type === 'add_item' || g.group_type === 'add_option'
    if (needsParent) {
      if (!g.parent_source_ref) {
        errors.push({ rule: 'hierarchy', group: gLabel, message: `${g.group_type} requires a parent group.` })
      } else {
        const parent = byRef.get(g.parent_source_ref)
        if (!parent) {
          errors.push({ rule: 'hierarchy', group: gLabel, message: `Parent "${g.parent_source_ref}" not found in payload.` })
        } else if (g.group_type === 'add_item' && parent.group_type !== 'base_bid' && parent.group_type !== 'option') {
          errors.push({ rule: 'hierarchy', group: gLabel, message: `add_item parent must be base_bid or option (got ${parent.group_type}).` })
        } else if (g.group_type === 'add_option' && parent.group_type === 'add_option') {
          errors.push({ rule: 'hierarchy', group: gLabel, message: 'add_option cannot be parented to another add_option.' })
        }
      }
    } else if (g.parent_source_ref) {
      errors.push({ rule: 'hierarchy', group: gLabel, message: `${g.group_type} stands alone and cannot have a parent.` })
    }

    // Scope code checks (2 + 3)
    if (g.scope_code) {
      const parsed = parseScopeCode(g.scope_code)
      if (!parsed.ok) {
        errors.push({ rule: 'code_item_consistency', group: gLabel, message: `Scope code "${g.scope_code}": ${parsed.error}` })
      } else {
        // 2. Depth balance — the single highest-value check in the list.
        const balance = checkDepthBalance(parsed)
        if (!balance.balanced) {
          errors.push({
            rule: 'depth_balance',
            group: gLabel,
            message: `Scope code "${parsed.code}": excavation is ${balance.excavationDepth}" but replacement layers sum to ${balance.replacementSum}". These must match.`,
          })
        }
        // 3. Code/item consistency — a code and items that disagree means one is stale.
        const itemText = g.items.map((i) => i.description).join(' \n ')
        for (const letter of ['E', 'A', 'S'] as const) {
          if (parsed.segments.some((s) => s.letter === letter) && !KEYWORDS[letter].test(itemText)) {
            const names = { E: 'an excavation', A: 'an asphalt', S: 'a stone' }[letter]
            errors.push({
              rule: 'code_item_consistency',
              group: gLabel,
              message: `Scope code contains ${letter} but the group has no ${names} line item.`,
            })
          }
        }
      }
    }

    // 1 + 5. UOM whitelist and positive quantities on every priced item.
    for (const item of g.items) {
      const iLabel = item.description || item.source_ref || '(unnamed item)'
      if (!item.description?.trim()) {
        errors.push({ rule: 'structure', group: gLabel, item: iLabel, message: 'Item description is required.' })
      }
      const uomError = validateUom(item.uom)
      if (uomError) {
        errors.push({ rule: 'uom', group: gLabel, item: iLabel, message: uomError })
      }
      if (item.qty === null || item.qty === undefined || !(item.qty > 0)) {
        errors.push({
          rule: 'positive_qty',
          group: gLabel,
          item: iLabel,
          message: `Quantity must be a positive number (got ${item.qty ?? 'nothing'}).`,
        })
      }
    }
  }

  return errors
}

/** Single-item validation for manual scope entry (same rules as import). */
export function validateItem(item: { description: string; qty: number | null; uom: string | null }): string[] {
  const errs: string[] = []
  if (!item.description?.trim()) errs.push('Description is required.')
  const uomError = validateUom(item.uom as Uom | null)
  if (uomError) errs.push(uomError)
  if (item.qty === null || !(item.qty > 0)) errs.push('Quantity must be a positive number.')
  return errs
}
