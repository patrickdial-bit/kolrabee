'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import './landing.css'

const taglines = [
  'Run the business. Own the outcome.',
  'Your playbook. Their hands.',
  'Run the business. Set the standard. They deliver.',
]

export default function HomePage() {
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [fadeClass, setFadeClass] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % taglines.length)
      setFadeClass('')
      requestAnimationFrame(() => setFadeClass('tagline-fade'))
    }, 3800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).style.opacity = '1'
            ;(e.target as HTMLElement).style.transform = 'translateY(0)'
            if (e.target.classList.contains('timeline-item')) {
              e.target.classList.add('visible')
            }
          }
        })
      },
      { threshold: 0.15 }
    )

    document
      .querySelectorAll('.step-card,.feature-card,.who-card,.stat-card,.ws,.job-card,.timeline-item')
      .forEach((el) => {
        if (!el.classList.contains('timeline-item')) {
          ;(el as HTMLElement).style.opacity = '0'
          ;(el as HTMLElement).style.transform = 'translateY(20px)'
          ;(el as HTMLElement).style.transition =
            'opacity 0.5s ease,transform 0.5s ease'
        }
        observerRef.current?.observe(el)
      })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="nav-logo">
          <span className="k">kol</span>
          <span className="r">ra</span>
          <span className="b">bee</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/admin/login">Login</Link>
          <Link href="/admin/signup" className="nav-cta">
            Get Started Free
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">
          For small trade business owners ready to scale
        </div>
        <h1 className="hero-headline">
          Run the business.
          <br />
          <span className="line-teal">Own the outcome.</span>
        </h1>
        <p className="hero-sub">
          You already have the CRM, the estimates, and the sales skills. Now you need a{' '}
          <strong>
            simple way to send jobs to your subs, track who accepted, and scale without the chaos.
          </strong>
        </p>
        <div className="hero-btns">
          <Link href="/admin/signup" className="btn-primary">
            Start Free Today
          </Link>
          <a href="#how" className="btn-ghost">
            See how it works
          </a>
        </div>
        <div className="hero-scroll">↓ scroll</div>
      </section>

      <div className="crm-bar">
        <div className="crm-label">Works alongside your existing tools</div>
        <div className="crm-logos">
          {[
            'PaintScout',
            'DripJobs',
            'Jobber',
            'Slack',
            'CompanyCam',
            'Housecall Pro',
            'ServiceTitan',
            '+ any CRM',
          ].map((name) => (
            <div key={name} className="crm-pill">
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* REAL WORLD SECTION */}
      <section className="realworld-section" id="realworld">
        <div className="container">
          <div className="section-tag">A real Monday morning</div>
          <h2 className="section-title" style={{ color: 'var(--white, #ffffff)' }}>
            5 jobs. 4 subs.
            <br />
            Different start times.
            <br />
            <span style={{ color: 'var(--teal, #00A896)' }}>All confirmed by 7:15am.</span>
          </h2>
          <p className="section-body">
            This is what Kolrabee is built for — short-term jobs, rapid turnaround, multiple crews running the same day. Day jobs, 2-day jobs, back-to-back weeks. Post once, get confirmed fast, stay in control.
          </p>
          <div className="day-timeline">
            <div className="timeline-item">
              <div className="tl-dot active">7:00</div>
              <div className="tl-content">
                <div className="tl-time">Monday 7:00am</div>
                <div className="tl-title">You post 3 jobs for the week</div>
                <div className="tl-body">Copy the work orders from your CRM. Set payout rates. Different start times, different locations, different crew requirements. Done in under 5 minutes.</div>
              </div>
            </div>
            <div className="timeline-item">
              <div className="tl-dot active">7:04</div>
              <div className="tl-content">
                <div className="tl-time">Monday 7:04am</div>
                <div className="tl-title">Subs get notified instantly</div>
                <div className="tl-body">Your crew sees the full job details — scope, payout, start time, location. No back-and-forth. No &ldquo;what time?&rdquo; texts. Everything they need is right there.</div>
              </div>
            </div>
            <div className="timeline-item">
              <div className="tl-dot active">7:09</div>
              <div className="tl-content">
                <div className="tl-time">Monday 7:09am</div>
                <div className="tl-title">First accepts start coming in</div>
                <div className="tl-body">Subs tap to accept. Race-proof engine ensures only one sub per job — even if two tap at the exact same second. No double-booking. No awkward calls.</div>
              </div>
            </div>
            <div className="timeline-item">
              <div className="tl-dot">7:15</div>
              <div className="tl-content">
                <div className="tl-time">Monday 7:15am</div>
                <div className="tl-title">All 3 jobs confirmed. Week locked in.</div>
                <div className="tl-body">You didn&rsquo;t make a single phone call. Every sub knows exactly where to be, when to show up, and what they&rsquo;re getting paid. You get back to selling.</div>
              </div>
            </div>
          </div>
          <div className="jobs-grid">
            <div className="job-card">
              <div className="job-card-label">Job 1 — Tuesday 8am</div>
              <div className="job-card-title">Interior repaint — 2 beds</div>
              <div className="job-card-detail">Marcus T. &middot; $380 payout &middot; 1 day</div>
              <div className="job-card-status status-accepted">&#x2713; Accepted 7:06am</div>
            </div>
            <div className="job-card">
              <div className="job-card-label">Job 2 — Tuesday 9am</div>
              <div className="job-card-title">Driveway seal — commercial</div>
              <div className="job-card-detail">Diego R. &middot; $520 payout &middot; 1 day</div>
              <div className="job-card-status status-accepted">&#x2713; Accepted 7:09am</div>
            </div>
            <div className="job-card">
              <div className="job-card-label">Job 3 — Wed–Thu</div>
              <div className="job-card-title">Full exterior — 2 day job</div>
              <div className="job-card-detail">Two subs &middot; $850 total &middot; 2 days</div>
              <div className="job-card-status status-accepted">&#x2713; Accepted 7:14am</div>
            </div>
          </div>
        </div>
      </section>

      <section className="who-section" id="who">
        <div className="container">
          <div className="section-tag">Built for both sides</div>
          <h2 className="section-title">
            Two users.
            <br />
            One platform.
          </h2>
          <p className="section-body">
            Whether you&rsquo;re the owner scaling off the tools or the sub who wants clear jobs and guaranteed pay — Kolrabee works for both of you.
          </p>
          <div className="who-grid">
            <div className="who-card owner">
              <div className="who-badge">For the owner</div>
              <div className="who-title">
                Your playbook.
                <br />
                <span className="accent-teal">Their hands.</span>
              </div>
              <ul className="who-list">
                <li>Already using a CRM to estimate? Copy the work order straight into Kolrabee</li>
                <li>Your sub rate is already calculated — just post the job and invite your crew</li>
                <li>Multiple jobs same day? Different start times? All managed in one place</li>
                <li>See instantly who accepted, who declined, and who&rsquo;s on the job</li>
                <li>Built for any small trade — painting, landscaping, asphalt, cleaning, and more</li>
              </ul>
            </div>
            <div className="who-card sub">
              <div className="who-badge">For the sub</div>
              <div className="who-title">
                Clear jobs.
                <br />
                <span className="accent-teal3">Guaranteed pay.</span>
              </div>
              <ul className="who-list">
                <li>See the full scope of work before you accept — no surprises on site</li>
                <li>Know your payout upfront, every single time</li>
                <li>Accept jobs instantly from your phone — first in gets it</li>
                <li>Track your year-to-date earnings in one place</li>
                <li>Build a track record that earns you first pick on future jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="container">
          <div className="section-tag">How it works</div>
          <h2 className="section-title">
            Three steps.
            <br />
            Zero chaos.
          </h2>
          <p className="section-body">
            Kolrabee plugs into the workflow you already have. You bring the job — we handle the dispatch.
          </p>
          <div className="steps-grid">
            <div className="step-card" data-num="01">
              <div className="step-icon icon-teal">📋</div>
              <div className="step-title">Post the job</div>
              <div className="step-body">
                Copy the work order from your CRM. Set the payout, start time, and any job-specific instructions. Day job, 2-day job, multiple crews — handle it all from one screen.
              </div>
            </div>
            <div className="step-card" data-num="02">
              <div className="step-icon icon-teal">👥</div>
              <div className="step-title">Invite your subs</div>
              <div className="step-body">
                Select which subs to send the job to. They get notified instantly, review every detail, and accept with one tap. First to accept wins — no double-booking, ever.
              </div>
            </div>
            <div className="step-card" data-num="03">
              <div className="step-icon icon-dark">✅</div>
              <div className="step-title">Track &amp; pay</div>
              <div className="step-body">
                Watch job status update in real time. Full visibility across every job running this week — who&rsquo;s confirmed, who&rsquo;s on site, who&rsquo;s done.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-num">99%</div>
            <div className="stat-desc">
              <strong>of all U.S. businesses are small businesses.</strong> The trades are the backbone of this economy — and the most underserved by software.
            </div>
            <div className="stat-source">Source: SBA Office of Advocacy, 2024</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">82%</div>
            <div className="stat-desc">
              <strong>of small businesses fail due to cash flow problems.</strong> Unclear sub agreements and missed jobs are a direct hit to your bottom line.
            </div>
            <div className="stat-source">Source: U.S. Bank / Small Business Studies</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">4x</div>
            <div className="stat-desc">
              <strong>less than the competition.</strong> HeyPros starts at $149/month. Kolrabee starts free. Same dispatch. A fraction of the price.
            </div>
            <div className="stat-source">Source: HeyPros published pricing, 2026</div>
          </div>
        </div>
      </div>

      <section className="workflow-section" id="workflow">
        <div className="container">
          <div className="section-tag">The missing piece</div>
          <h2 className="section-title">
            Your CRM gets you
            <br />
            the job. We deliver it.
          </h2>
          <p className="section-body">
            Most trade business owners have great sales tools. What they&rsquo;re missing is a fast, reliable way to hand jobs off to subs and know they&rsquo;ll get done right.
          </p>
          <div className="workflow-card">
            <div>
              <div className="workflow-title">
                Your <span>existing stack</span> just got a missing piece.
              </div>
              <div className="workflow-body">
                You&rsquo;ve got tools to close jobs and manage customers. But the moment that job goes to a sub — it falls into a text thread and a prayer. Kolrabee is the layer between your CRM and your crew.
              </div>
            </div>
            <div className="workflow-steps">
              <div className="ws">
                <div className="ws-num">1</div>
                <div className="ws-text">
                  <strong>Win the job</strong> in your CRM — PaintScout, Jobber, DripJobs, whatever you use
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">2</div>
                <div className="ws-text">
                  <strong>Copy the work order</strong> into Kolrabee with payout and start time already set
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">3</div>
                <div className="ws-text">
                  <strong>Invite your subs</strong> — they see every detail and accept instantly from their phone
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">4</div>
                <div className="ws-text">
                  <strong>Track in real time</strong> — full visibility from accepted to on-site to done
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="container">
          <div className="section-tag">Features</div>
          <h2 className="section-title">
            Simple by design.
            <br />
            Powerful by result.
          </h2>
          <p className="section-body">
            No bloated software. No steep learning curve. Just the tools a small trade business owner needs to dispatch fast and scale with confidence.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <div className="feature-title">Job Posting</div>
              <div className="feature-body">
                Post jobs with full scope, payout, start time, and instructions. Day jobs, multi-day jobs, multiple crews — all handled from one screen.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <div className="feature-title">Race-Proof Assignments</div>
              <div className="feature-body">
                Two subs accept at the same time? Only one wins. No double-booking. No awkward calls. Handles it automatically — even on your busiest days.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <div className="feature-title">Acceptance Tracking</div>
              <div className="feature-body">
                See in real time who accepted, who declined, and the full status of every job. Always know exactly where things stand across your whole week.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <div className="feature-title">YTD Earnings</div>
              <div className="feature-body">
                Subs see their year-to-date earnings front and center. Transparent, motivating, and keeps your best crew coming back for more jobs.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <div className="feature-title">Multi-Company</div>
              <div className="feature-body">
                Running a painting company and a landscaping company? Each gets its own workspace and URL. Clean, separate, and built to scale.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <div className="feature-title">Mobile First</div>
              <div className="feature-body">
                Your subs live on their phones. Kolrabee is built for it. Accept jobs, check pay, see job details — from anywhere, in seconds.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="tagline-section">
        <div className={`tagline-rotating ${fadeClass}`}>
          {taglines[taglineIdx]}
        </div>
      </div>

      <section className="cta-section">
        <div className="container">
          <div className="cta-title">
            Ready to <span>scale</span>
            <br />
            without the chaos?
          </div>
          <p className="cta-sub">
            Join small trade business owners who&rsquo;ve stopped losing jobs in text threads and started building real systems.
          </p>
          <div className="cta-btns">
            <Link href="/admin/signup" className="btn-big">
              Start Free Today
            </Link>
            <Link href="/admin/login" className="btn-big-ghost">
              I already have an account
            </Link>
          </div>
          <p className="cta-note">
            Free to get started. No credit card required.
          </p>
        </div>
      </section>

      <footer>
        <Link href="/" className="footer-logo">
          <span className="k">kol</span>
          <span className="r">ra</span>
          <span className="b">bee</span>
        </Link>
        <p>&copy; 2026 Kolrabee. All rights reserved.</p>
      </footer>
    </div>
  )
}
