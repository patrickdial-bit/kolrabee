'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Tenant } from '@/lib/types'
import { isTenantActive } from '@/lib/types'
import { PLANS, ALL_PLANS } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'
import { updateNotificationEmail } from './actions'

interface Props {
  tenant: Tenant
}

export default function BillingClient({ tenant }: Props) {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifEmail, setNotifEmail] = useState(tenant.notification_email || '')
  const [notifSaved, setNotifSaved] = useState(false)

  const isActive = isTenantActive(tenant)
  const isFree = tenant.plan === 'free'
  const isTrial = tenant.plan === 'trial'
  const hasSubscription = tenant.plan === 'starter' || tenant.plan === 'pro'
  const trialDaysLeft = tenant.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  async function handleCheckout(plan: PlanId) {
    setLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setLoading('portal')
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to open billing portal. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your subscription plan and billing details.</p>

      {/* Success / Cancel Messages */}
      {success && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-700">Subscription activated successfully! Your account is now on the {tenant.plan} plan.</p>
        </div>
      )}
      {canceled && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-700">Checkout was canceled. No changes were made to your subscription.</p>
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Current Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 capitalize">{tenant.plan}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasSubscription
                  ? 'bg-green-100 text-green-700'
                  : isFree
                    ? 'bg-gray-100 text-gray-700'
                    : isTrial && isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
              }`}>
                {hasSubscription ? 'Active' : isFree ? 'Free Plan' : isTrial && isActive ? `Trial (${trialDaysLeft} days left)` : isTrial ? 'Trial Expired' : 'Cancelled'}
              </span>
            </div>
          </div>
          {hasSubscription && (
            <button
              onClick={handleManageBilling}
              disabled={loading === 'portal'}
              className="inline-flex items-center rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading === 'portal' ? 'Loading...' : 'Manage Billing'}
            </button>
          )}
        </div>

        {/* Usage Info */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Project Limit</p>
            <p className="text-sm font-semibold text-gray-900">
              {tenant.max_projects >= 999999 ? 'Unlimited' : `${tenant.max_projects} projects`}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Subcontractor Limit</p>
            <p className="text-sm font-semibold text-gray-900">
              {tenant.max_subcontractors >= 999999 ? 'Unlimited' : `${tenant.max_subcontractors} subcontractors`}
            </p>
          </div>
        </div>

        {/* Trial Warning */}
        {isTrial && isActive && trialDaysLeft <= 7 && (
          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              {trialDaysLeft === 0
                ? 'Your trial expires today. Subscribe to a plan to continue creating projects.'
                : `Your trial expires in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}. Subscribe to a plan to avoid interruption.`}
            </p>
          </div>
        )}

        {/* Free Plan Upsell */}
        {isFree && (
          <div className="mt-4 rounded-md bg-indigo-50 border border-indigo-200 p-3">
            <p className="text-sm text-indigo-800">
              You&apos;re on the Free plan. Upgrade to unlock more projects, subcontractors, and features.
            </p>
          </div>
        )}

        {/* Expired State */}
        {!isActive && !isFree && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800">
              Your subscription is inactive. You cannot create new projects until you subscribe to a plan.
            </p>
          </div>
        )}
      </div>

      {/* Notification Email Setting */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900">Notification Email</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Set a reply-to email for notifications sent to your subcontractors. Emails will show as
          &ldquo;{tenant.name} via TradeTap&rdquo; and replies will go to this address.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setLoading('notif')
            setError(null)
            setNotifSaved(false)
            const result = await updateNotificationEmail(notifEmail)
            if (result.error) {
              setError(result.error)
            } else {
              setNotifSaved(true)
              setTimeout(() => setNotifSaved(false), 3000)
            }
            setLoading(null)
          }}
          className="flex items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="notif-email" className="block text-sm font-medium text-gray-700 mb-1">Reply-to Email</label>
            <input
              id="notif-email"
              type="email"
              placeholder="dispatch@yourcompany.com"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading === 'notif'}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'notif' ? 'Saving...' : 'Save'}
          </button>
          {notifSaved && (
            <span className="text-sm text-green-600 font-medium">Saved</span>
          )}
        </form>
        <p className="text-xs text-gray-400 mt-2">Leave blank to send from the default TradeTap address.</p>
      </div>

      {/* Plan Cards */}
      {!hasSubscription && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isFree ? 'Upgrade Your Plan' : 'Choose a Plan'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan Card */}
            <div className={`relative bg-white rounded-xl border-2 shadow-sm p-6 ${
              isFree ? 'border-green-500' : 'border-gray-200'
            }`}>
              {isFree && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-green-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Current Plan
                </span>
              )}

              <h3 className="text-xl font-bold text-gray-900">{ALL_PLANS.free.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-sm text-gray-500">/month</span>
              </div>

              <ul className="mt-6 space-y-3">
                {ALL_PLANS.free.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed"
              >
                {isFree ? 'Current Plan' : 'Free'}
              </button>
            </div>

            {/* Paid Plan Cards */}
            {(Object.entries(PLANS) as [PlanId, typeof PLANS[PlanId]][]).map(([planId, plan]) => (
              <div
                key={planId}
                className={`relative bg-white rounded-xl border-2 shadow-sm p-6 ${
                  planId === 'pro' ? 'border-indigo-500' : 'border-gray-200'
                }`}
              >
                {planId === 'pro' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(planId)}
                  disabled={loading !== null}
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    planId === 'pro'
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-white text-indigo-700 border-2 border-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {loading === planId ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
