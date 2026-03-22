'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import KolrabeeLogo from '@/components/KolrabeeLogo'

const taglines = [
  { main: 'Run the business.', accent: 'Own the outcome.' },
  { main: 'Your playbook.', accent: 'Their hands.' },
  { main: 'Run the business. Set the standard.', accent: 'They deliver.' },
]

export default function HomePage() {
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setTaglineIdx((i) => (i + 1) % taglines.length)
        setFade(true)
      }, 400)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const tagline = taglines[taglineIdx]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero — forest green */}
      <div className="bg-forest">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <KolrabeeLogo size="lg" variant="dark" />
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Admin Login
            </Link>
            <Link
              href="/admin/signup"
              className="inline-flex items-center rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
            <div className="mb-8">
              <KolrabeeLogo size="xl" variant="dark" />
            </div>
            <div
              className={`min-h-[120px] sm:min-h-[160px] flex flex-col items-center justify-center transition-opacity duration-400 ${fade ? 'opacity-100' : 'opacity-0'}`}
            >
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl font-display">
                {tagline.main}
                <span className="block text-ember">{tagline.accent}</span>
              </h1>
            </div>
            <p className="mt-6 text-lg leading-8 text-white/70">
              The simple way to build trust with every sub. Post jobs,
              invite crews, track who accepted, and get everyone paid.
            </p>
            <p className="mt-3 text-white/50" style={{ fontSize: '13px' }}>
              Pronounced kohl&middot;rah&middot;bee &mdash; like the vegetable kohlrabi
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/admin/signup"
                className="inline-flex items-center rounded-lg bg-ember px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
              >
                Start Free
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center rounded-lg border border-white/40 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Learn more <span className="ml-2" aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* Features — cream background, white cards */}
      <div className="bg-canvas flex-1">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-black font-display text-forge sm:text-4xl">
              Everything you need to manage your crews
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Post Jobs',
                description: 'Create projects with job details, payout amounts, and start dates. Everything your subs need to know.',
                accent: 'ember',
              },
              {
                title: 'Invite Subcontractors',
                description: 'Select which subs to invite to each project. They get notified and can accept instantly.',
                accent: 'forest',
              },
              {
                title: 'Track Acceptance',
                description: 'See who accepted, who declined, and manage the full lifecycle from available to paid.',
                accent: 'ember',
              },
              {
                title: 'Race-Proof Assignments',
                description: 'When two subs click accept simultaneously, only one wins. No double-booking, ever.',
                accent: 'forest',
              },
              {
                title: 'YTD Earnings',
                description: 'Subs see their year-to-date earnings front and center. Motivational and transparent.',
                accent: 'ember',
              },
              {
                title: 'Multi-Tenant',
                description: 'Each company gets their own workspace with a unique URL. Clean separation of data.',
                accent: 'forest',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`rounded-xl bg-white p-6 shadow-sm border-t-4 ${
                  feature.accent === 'ember' ? 'border-ember' : 'border-forest'
                }`}
              >
                <h3 className={`text-lg font-bold font-display ${
                  feature.accent === 'ember' ? 'text-ember' : 'text-forest'
                }`}>{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-forge/60">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer — forge dark */}
      <footer className="bg-forge py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <KolrabeeLogo size="lg" variant="dark" />
            <p className="text-sm text-white/50">
              &copy; {new Date().getFullYear()} Kolrabee. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
