import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500">
            <span className="text-lg font-bold text-white">K</span>
          </div>
          <span className="text-xl font-bold text-white">Kolrabee</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="text-sm font-medium text-indigo-200 transition-colors hover:text-white"
          >
            Admin Login
          </Link>
          <Link
            href="/admin/signup"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pt-20 pb-32 text-center sm:pt-32 sm:pb-40">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Post Jobs. Invite Subs.
            <span className="block text-indigo-400">Get Paid.</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Kolrabee is the simplest way for home services companies to post jobs,
            invite subcontractors, track who accepted, and record when they&apos;re paid.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/admin/signup"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              Start Free
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
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
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
