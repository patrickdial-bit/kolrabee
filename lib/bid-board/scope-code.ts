// Scope code parser (spec: docs/bid-board-spec.md "Scope code parser")
//
// Grammar:
//   CODE    := SEGMENT+
//   SEGMENT := LETTERS DEPTH?
//   LETTERS := E | S | A | O | I | OL | M | P | FG   (longest match wins)
//   DEPTH   := number (inches, may be decimal)
//
// Repeated letters are different materials in sequence, not repeated lifts.
// Materials resolve against scope_code_materials with `ordinal` counted FROM
// THE LAST occurrence: the final lift of a letter is ordinal 1 (also the bare
// default), the one before it ordinal 2, etc. E10S2S4A2.5A1.5 therefore reads
// second S = ordinal 1 (#304), first S = ordinal 2 (#2 stone).

import type { ScopeCodeMaterial } from './types'

// Longest tokens first so OL wins over O, FG over F-garbage.
const LETTERS = ['OL', 'FG', 'E', 'S', 'A', 'O', 'I', 'M', 'P'] as const

export type ScopeSegment = {
  letter: string
  depth: number | null
  /** 1-based position among same-letter segments, counted from the last */
  ordinalFromEnd: number
}

export type DecodedLayer = ScopeSegment & {
  materialName: string
  spec: string | null
}

export type ParsedScopeCode =
  | { ok: true; code: string; segments: ScopeSegment[] }
  | { ok: false; code: string; error: string }

export function parseScopeCode(raw: string): ParsedScopeCode {
  const code = raw.trim().toUpperCase()
  if (!code) return { ok: false, code, error: 'Empty scope code' }

  const segments: Omit<ScopeSegment, 'ordinalFromEnd'>[] = []
  let i = 0
  while (i < code.length) {
    const letter = LETTERS.find((l) => code.startsWith(l, i))
    if (!letter) {
      return { ok: false, code, error: `Unrecognized letter at position ${i + 1}: "${code[i]}"` }
    }
    i += letter.length
    const m = /^\d+(\.\d+)?/.exec(code.slice(i))
    let depth: number | null = null
    if (m) {
      depth = parseFloat(m[0])
      i += m[0].length
    }
    segments.push({ letter, depth })
  }

  // Assign ordinals counted from the last occurrence of each letter.
  const remaining: Record<string, number> = {}
  for (const s of segments) remaining[s.letter] = (remaining[s.letter] ?? 0) + 1
  const withOrdinals: ScopeSegment[] = segments.map((s) => {
    const ordinalFromEnd = remaining[s.letter]
    remaining[s.letter] -= 1
    return { ...s, ordinalFromEnd }
  })

  return { ok: true, code, segments: withOrdinals }
}

/** Resolve parsed segments to display materials using the lookup table. */
export function decodeScopeCode(
  parsed: ParsedScopeCode,
  materials: ScopeCodeMaterial[]
): DecodedLayer[] {
  if (!parsed.ok) return []
  // Tenant rows override globals for the same (letter, ordinal).
  const byKey = new Map<string, ScopeCodeMaterial>()
  for (const m of materials) {
    const key = `${m.letter}:${m.ordinal}`
    const existing = byKey.get(key)
    if (!existing || (existing.tenant_id === null && m.tenant_id !== null)) {
      byKey.set(key, m)
    }
  }
  return parsed.segments.map((s) => {
    const hit = byKey.get(`${s.letter}:${s.ordinalFromEnd}`) ?? byKey.get(`${s.letter}:1`)
    return {
      ...s,
      materialName: hit?.material_name ?? `${s.letter} material`,
      spec: hit?.default_spec ?? null,
    }
  })
}

export type DepthBalanceResult =
  | { balanced: true }
  | { balanced: false; excavationDepth: number; replacementSum: number }

/**
 * Gate 1 depth balance: for a code with excavation, the excavation depth must
 * equal the sum of the replacement layer depths that follow it (up to the next
 * E segment). E6S4A2 -> 4+2=6 OK. E6S4A2.5 -> 6.5 != 6, reject.
 */
export function checkDepthBalance(parsed: ParsedScopeCode): DepthBalanceResult {
  if (!parsed.ok) return { balanced: true }
  const segs = parsed.segments
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].letter !== 'E' || segs[i].depth === null) continue
    let sum = 0
    for (let j = i + 1; j < segs.length && segs[j].letter !== 'E'; j++) {
      sum += segs[j].depth ?? 0
    }
    if (Math.abs(sum - (segs[i].depth as number)) > 0.01) {
      return { balanced: false, excavationDepth: segs[i].depth as number, replacementSum: sum }
    }
  }
  return { balanced: true }
}
