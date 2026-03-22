'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { setupSuperAdmin } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Setting up...' : 'Create Super Admin'}
    </button>
  )
}

export default function SuperAdminSetupPage() {
  const [state, formAction] = useFormState(setupSuperAdmin, null)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          Kolrabee
        </h1>
        <h2 className="mt-2 text-center text-lg text-gray-600">
          Super Admin Setup
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          One-time setup for the platform super admin
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg rounded-xl sm:px-10">
          {state?.error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none sm:text-sm"
                placeholder="patrick@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none sm:text-sm"
                placeholder="Min 6 characters"
              />
            </div>

            <div>
              <label htmlFor="secret_key" className="block text-sm font-medium text-gray-700">
                Setup Key
              </label>
              <input
                id="secret_key"
                name="secret_key"
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none sm:text-sm"
                placeholder="From SUPER_ADMIN_SETUP_KEY env var"
              />
            </div>

            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  )
}
