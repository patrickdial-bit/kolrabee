'use client'

// Structured address inputs (street / city / state / zip) shared by the
// create-project and edit-project forms. All parts are required so every job
// has a complete, geocodable address and shows up correctly on the map.
//
// Inputs are uncontrolled (defaultValue) — the forms submit them as plain
// FormData fields named street/city/state/zip, which the server actions compose
// into the stored address.

import { US_STATES, type AddressParts } from '@/lib/address'

const inputClass =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-ember focus:ring-1 focus:ring-ember sm:text-sm'

export default function AddressFields({ defaults }: { defaults?: Partial<AddressParts> }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
          Street Address <span className="text-amber-500">*</span>
        </label>
        <input
          type="text"
          id="street"
          name="street"
          required
          defaultValue={defaults?.street ?? ''}
          className={inputClass}
          placeholder="e.g. 175 Loveman Ave"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
        <div className="sm:col-span-3">
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            City <span className="text-amber-500">*</span>
          </label>
          <input
            type="text"
            id="city"
            name="city"
            required
            defaultValue={defaults?.city ?? ''}
            className={inputClass}
            placeholder="e.g. Columbus"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
            State <span className="text-amber-500">*</span>
          </label>
          <select
            id="state"
            name="state"
            required
            defaultValue={defaults?.state ?? ''}
            className={inputClass}
          >
            <option value="" disabled>
              State
            </option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
            ZIP <span className="text-amber-500">*</span>
          </label>
          <input
            type="text"
            id="zip"
            name="zip"
            required
            inputMode="numeric"
            pattern="\d{5}(-\d{4})?"
            title="5-digit ZIP code"
            defaultValue={defaults?.zip ?? ''}
            className={inputClass}
            placeholder="43201"
          />
        </div>
      </div>
    </div>
  )
}
