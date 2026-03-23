import Link from 'next/link'
import KolrabeeLogo from '@/components/KolrabeeLogo'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/">
          <KolrabeeLogo size="lg" />
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm font-medium text-forge/60 transition-colors hover:text-forge"
          >
            About
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-forge/60 transition-colors hover:text-forge"
          >
            Pricing
          </Link>
          <Link
            href="/admin/login"
            className="text-sm font-medium text-forge/60 transition-colors hover:text-forge"
          >
            Login
          </Link>
          <Link
            href="/admin/signup"
            className="inline-flex items-center rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <KolrabeeLogo size="xl" />
          <p className="mt-2" style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>
            Pronounced: kohl &middot; rah &middot; bee
          </p>
          <p className="mt-4 text-lg text-forge/70">
            Construction subcontractor management, simplified.
          </p>
        </div>

        {/* Pronunciation Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-12">
          <h2 className="text-2xl font-black font-display text-forge mb-6">
            How do you say it?
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-forge/60 uppercase tracking-wide">Name:</span>
              <span className="text-xl font-bold font-display text-forge">Kolrabee</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-forge/60 uppercase tracking-wide">Sounds like:</span>
              <span className="text-lg text-forge/80 italic">the vegetable kohlrabi</span>
            </div>
          </div>

          {/* Syllable breakdown */}
          <div className="bg-canvas rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-3 text-3xl font-black font-display">
              <span className="text-forge">KOHL</span>
              <span className="text-forge/30">&middot;</span>
              <span className="text-ember">RAH</span>
              <span className="text-forge/30">&middot;</span>
              <span className="text-forest">BEE</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-forge/10 px-3 py-1 text-sm font-bold font-display text-forge shrink-0">
                KOHL
              </span>
              <span className="text-forge/70">
                rhymes with &ldquo;coal&rdquo;
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-ember/10 px-3 py-1 text-sm font-bold font-display text-ember shrink-0">
                RAH
              </span>
              <span className="text-forge/70">
                rhymes with &ldquo;spa&rdquo;
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-forest/10 px-3 py-1 text-sm font-bold font-display text-forest shrink-0">
                BEE
              </span>
              <span className="text-forge/70">
                like the insect
              </span>
            </div>
          </div>
        </section>

        {/* Brand Story */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-12">
          <h2 className="text-2xl font-black font-display text-forge mb-4">
            What we do
          </h2>
          <p className="text-forge/70 leading-7">
            Kolrabee is a construction subcontractor management platform. We make it simple to
            post jobs, invite crews, track who accepted, and get everyone paid. Each company gets
            their own workspace &mdash; clean, fast, and built for the way contractors actually work.
          </p>
        </section>

        <div className="mt-12 text-center">
          <Link
            href="/admin/signup"
            className="inline-flex items-center rounded-lg bg-ember px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-8 mt-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-sm text-forge/40">
            &copy; {new Date().getFullYear()} Kolrabee. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
