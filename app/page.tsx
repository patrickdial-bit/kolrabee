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
    <div className="min-h-screen bg-forge">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <KolrabeeLogo size="lg" className="!text-white [&>span]:!text-white [&>span:nth-child(2)]:!text-ember [&>span:nth-child(3)]:!text-forest" />
        <div className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
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
        <div className="mx-auto max-w-3xl pt-20 pb-32 text-center sm:pt-32 sm:pb-40">
          <div className="mb-8">
            <KolrabeeLogo size="xl" />
          </div>
          <div
            className={`min-h-[120px] sm:min-h-[160px] flex flex-col items-center justify-center transition-opacity duration-400 ${fade ? 'opacity-100' : 'opacity-0'}`}
          >
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl font-display">
              {tagline.main}
              <span className="block text-ember">{tagline.accent}</span>
            </h1>
          </div>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            The simple way to build trust with every sub. Post jobs,
            invite crews, track who accepted, and get everyone paid.
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
              className="text-sm font-semibold leading-6 text-gray-400 hover:text-white transition-colors"
            >
              Learn more <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>

        <div className="pb-24">
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Post Jobs',
                description: 'Create projects with job details, payout amounts, and start dates. Everything your subs need to know.',
              },
              {
                title: 'Invite Subcontractors',
                description: 'Select which subs to invite to each project. They get notified and can accept instantly.',
              },
              {
                title: 'Track Acceptance',
                description: 'See who accepted, who declined, and manage the full lifecycle from available to paid.',
              },
              {
                title: 'Race-Proof Assignments',
                description: 'When two subs click accept simultaneously, only one wins. No double-booking, ever.',
              },
              {
                title: 'YTD Earnings',
                description: 'Subs see their year-to-date earnings front and center. Motivational and transparent.',
              },
              {
                title: 'Multi-Tenant',
                description: 'Each company gets their own workspace with a unique URL. Clean separation of data.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <h3 className="text-lg font-bold text-white font-display">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Kolrabee. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
