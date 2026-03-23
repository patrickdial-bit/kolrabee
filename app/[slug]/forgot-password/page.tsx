'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { forgotPasswordAction } from './actions'

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
          Sending link...
        </span>
      ) : (
        'Send reset link'
      )}
    </button>
  )
}

export default function SubForgotPasswordPage() {
  const params = useParams()
  const slug = params.slug as string
  const [state, formAction] = useFormState(forgotPasswordAction, null)

  return (
    <div className="min-h-screen bg-ember/10 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          Kolrabee
        </h1>
        <h2 className="mt-2 text-center text-lg text-gray-600">
          Reset your password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg rounded-xl sm:px-10">
          {state?.success ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Check your email</h3>
              <p className="mt-2 text-sm text-gray-600">
                If an account exists with that email, we&apos;ve sent a password reset link.
                Please check your inbox and spam folder.
              </p>
              <Link
                href={`/${slug}/login`}
                className="mt-6 inline-block text-sm font-semibold text-ember hover:text-ember transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {state?.error && (
                <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-700">{state.error}</p>
                </div>
              )}

              <p className="mb-6 text-sm text-gray-600">
                Enter the email address associated with your account and we&apos;ll send you a
                link to reset your password.
              </p>

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

                <SubmitButton />
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Remember your password?{' '}
                <Link
                  href={`/${slug}/login`}
                  className="font-semibold text-ember hover:text-ember transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
