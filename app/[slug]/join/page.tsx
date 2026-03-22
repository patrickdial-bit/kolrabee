'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import KolrabeeLogo from '@/components/KolrabeeLogo'
import { joinAction } from './actions'

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
          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Creating account...
        </span>
      ) : (
        'Create account'
      )}
    </button>
  )
}

export default function SubJoinPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const prefillEmail = searchParams.get('email') || ''
  const prefillName = searchParams.get('name') || ''
  const [firstName, ...lastParts] = prefillName.split(' ')
  const prefillFirst = firstName || ''
  const prefillLast = lastParts.join(' ') || ''
  const [state, formAction] = useFormState(joinAction, null)

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center"><KolrabeeLogo size="lg" /></div>
        <h2 className="mt-2 text-center text-lg text-gray-600">Create your subcontractor account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-6 shadow-lg rounded-xl sm:px-10">
          {state?.error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          {state?.notFound ? (
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Company not found</h3>
              <p className="mt-2 text-sm text-gray-600">
                The company link you followed does not exist. Please check the URL and try again.
              </p>
            </div>
          ) : (
            <>
              <form action={formAction} className="space-y-5">
                <input type="hidden" name="slug" value={slug} />

                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                    placeholder="Your company name"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input id="firstName" name="firstName" type="text" required
                      defaultValue={prefillFirst}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                      placeholder="John" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input id="lastName" name="lastName" type="text" required
                      defaultValue={prefillLast}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                      placeholder="Doe" />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input id="email" name="email" type="email" required autoComplete="email"
                    defaultValue={prefillEmail}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                    placeholder="john@example.com" />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone number <span className="text-red-500">*</span>
                  </label>
                  <input id="phone" name="phone" type="tel" required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                    placeholder="(555) 123-4567" />
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Business Address <span className="text-red-500">*</span>
                  </label>
                  <input id="address" name="address" type="text" required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                    placeholder="123 Main St, Columbus, OH 43215" />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <label htmlFor="crewSize" className="block text-sm font-medium text-gray-700">Crew Members</label>
                    <input id="crewSize" name="crewSize" type="number" min="1" defaultValue="1"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm" />
                  </div>
                  <div>
                    <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700">Years in Business</label>
                    <input id="yearsInBusiness" name="yearsInBusiness" type="number" min="0"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                      placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label htmlFor="insuranceProvider" className="block text-sm font-medium text-gray-700">Insurance Provider</label>
                    <input id="insuranceProvider" name="insuranceProvider" type="text"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                      placeholder="e.g. Progressive" />
                  </div>
                </div>

                <div>
                  <label htmlFor="insuranceExpiration" className="block text-sm font-medium text-gray-700">Insurance Expiration Date</label>
                  <input id="insuranceExpiration" name="insuranceExpiration" type="date"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm" />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-ember focus:ring-2 focus:ring-ember focus:outline-none sm:text-sm"
                    placeholder="Min. 8 characters" />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 font-medium">After signing up, you will need to upload your W-9 and Certificate of Insurance (COI) from your profile before you can receive job invitations.</p>
                </div>

                <SubmitButton />
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href={`/${slug}/login`} className="font-semibold text-ember hover:text-primary-700 transition-colors">
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
