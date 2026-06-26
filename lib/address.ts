// Structured US address helpers.
//
// Projects store the address as a single text field, but we collect it as
// street / city / state / zip so it always geocodes accurately (a bare street
// like "175 Loveman Ave" resolves to the wrong city). composeAddress builds the
// stored string in the "street, city, ST zip" shape that extractCity() expects;
// parseAddress does the reverse, best-effort, to prefill the edit form.

export type AddressParts = {
  street: string
  city: string
  state: string
  zip: string
}

export const US_STATES: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
]

const STATE_CODES = new Set(US_STATES.map((s) => s.code))

export function isValidStateCode(code: string): boolean {
  return STATE_CODES.has(code.trim().toUpperCase())
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim())
}

/**
 * Read street/city/state/zip from submitted FormData, validate them, and return
 * the composed address (or an error message). Falls back to a legacy single
 * "address" field if the structured fields are absent, for backward safety.
 */
export function readAddressFromForm(formData: FormData): { address: string } | { error: string } {
  const street = ((formData.get('street') as string) || '').trim()
  const city = ((formData.get('city') as string) || '').trim()
  const state = ((formData.get('state') as string) || '').trim().toUpperCase()
  const zip = ((formData.get('zip') as string) || '').trim()

  const legacy = ((formData.get('address') as string) || '').trim()
  if (!street && !city && !state && !zip && legacy) {
    return { address: legacy }
  }

  if (!street) return { error: 'Street address is required.' }
  if (!city) return { error: 'City is required.' }
  if (!isValidStateCode(state)) return { error: 'A valid state is required.' }
  if (!isValidZip(zip)) return { error: 'A valid 5-digit ZIP code is required.' }

  return { address: composeAddress({ street, city, state, zip }) }
}

/** Build the stored "street, city, ST zip" address from its parts. */
export function composeAddress(parts: AddressParts): string {
  const street = parts.street.trim()
  const city = parts.city.trim()
  const state = parts.state.trim().toUpperCase()
  const zip = parts.zip.trim()
  return `${street}, ${city}, ${state} ${zip}`
}

/**
 * Best-effort split of a stored address back into parts to prefill the edit
 * form. Handles the canonical "street, city, ST zip" shape; for older
 * free-text/street-only values it returns what it can and leaves the rest blank
 * so the admin is prompted to complete it.
 */
export function parseAddress(address: string | null | undefined): AddressParts {
  const empty: AddressParts = { street: '', city: '', state: '', zip: '' }
  if (!address) return empty
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean)

  if (segments.length === 0) return empty
  if (segments.length === 1) return { ...empty, street: segments[0] }

  // Last segment usually holds "ST zip" (or "ST", or "city ST zip").
  const last = segments[segments.length - 1]
  const stateZip = last.match(/\b([A-Za-z]{2})\b\s*(\d{5}(?:-\d{4})?)?$/)
  const state = stateZip && isValidStateCode(stateZip[1]) ? stateZip[1].toUpperCase() : ''
  const zip = stateZip?.[2] ?? ''

  // Street is everything before the city; city is the second-to-last segment
  // when the last one parsed as state/zip, otherwise the last segment.
  if (state || zip) {
    const city = segments.length >= 3 ? segments[segments.length - 2] : ''
    const streetEnd = segments.length >= 3 ? segments.length - 2 : segments.length - 1
    const street = segments.slice(0, streetEnd).join(', ')
    return { street, city, state, zip }
  }

  return { street: segments.slice(0, -1).join(', '), city: last, state: '', zip: '' }
}
