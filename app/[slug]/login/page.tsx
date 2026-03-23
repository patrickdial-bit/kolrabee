'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import KolrabeeLogo from '@/components/KolrabeeLogo'
import { loginAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-ember hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ember disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Signing in...
        </span>
      ) : (
        'Sign in'
      )}
    </button>
  )
}

export default function SubLoginPage() {
  const params = useParams()
  const slug = params.slug as string
  const [state, formAction] = useFormState(loginAction, null)

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <KolrabeeLogo size="lg" />
        </div>
        <h2 className="mt-2 text-center text-lg text-gray-600">
          Subcontractor sign in
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg rounded-xl sm:px-10">
          {state?.error && (
            <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-700">{state.error}</p>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="slug" value={slug} />

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href={`/${slug}/forgot-password`}
                  className="text-sm font-medium text-ember hover:text-primary-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                placeholder="Your password"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link
              href={`/${slug}/join`}
              className="font-semibold text-ember hover:text-primary-700 transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
