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
          }
        })
      },
      { threshold: 0.1 }
    )

    document
      .querySelectorAll('.step-card,.feature-card,.who-card,.stat-card,.ws')
      .forEach((el) => {
        ;(el as HTMLElement).style.opacity = '0'
        ;(el as HTMLElement).style.transform = 'translateY(20px)'
        ;(el as HTMLElement).style.transition =
          'opacity 0.5s ease,transform 0.5s ease'
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
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
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
          <span className="line-orange">Own the outcome.</span>
        </h1>
        <p className="hero-sub">
          You have the skills, the CRM, and the customers. What you need is a{' '}
          <strong>
            simple, reliable way to send jobs to your subs, see who accepted,
            and scale without the chaos.
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
        <div className="crm-label">Sits alongside your existing tools</div>
        <div className="crm-logos">
          {[
            'PaintScout',
            'DripJobs',
            'Jobber',
            'Slack',
            'CompanyCam',
            'Housecall Pro',
            'ServiceTitan',
            'LMN',
            '+ any CRM',
          ].map((name) => (
            <div key={name} className="crm-pill">
              {name}
            </div>
          ))}
        </div>
      </div>

      <section className="who-section" id="who">
        <div className="container">
          <div className="section-tag">Built for both sides</div>
          <h2 className="section-title">
            Two users.
            <br />
            One platform.
          </h2>
          <p className="section-body">
            Kolrabee works because it&rsquo;s built for everyone in the equation
            — not just the owner. When your subs love it, your jobs get done
            right.
          </p>
          <div className="who-grid">
            <div className="who-card owner">
              <div className="who-badge">For the owner</div>
              <div className="who-title">
                Your playbook.
                <br />
                <span className="ao">Their hands.</span>
              </div>
              <ul className="who-list">
                <li>
                  Already estimating in a CRM? Copy the work order straight into
                  Kolrabee
                </li>
                <li>
                  Sub rate already calculated — just post the job and send it out
                </li>
                <li>
                  See in real time who accepted, who passed, and who&rsquo;s on
                  the job
                </li>
                <li>
                  Scale to more crews without more calls, texts, and confusion
                </li>
                <li>
                  Works for painters, landscapers, asphalt crews, cleaners, and
                  beyond
                </li>
              </ul>
            </div>
            <div className="who-card sub">
              <div className="who-badge">For the sub</div>
              <div className="who-title">
                Clear jobs.
                <br />
                <span className="ag">Guaranteed pay.</span>
              </div>
              <ul className="who-list">
                <li>
                  See the full scope of work before you accept — no surprises on
                  site
                </li>
                <li>Know your payout upfront, every single time</li>
                <li>Accept from your phone — first in gets it</li>
                <li>Track your year-to-date earnings in one place</li>
                <li>
                  Build a track record that earns you first pick on future jobs
                </li>
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
            Kolrabee plugs into the workflow you already have. You bring the job
            — we handle the dispatch.
          </p>
          <div className="steps-grid">
            <div className="step-card" data-num="01">
              <div className="step-icon icon-orange">📋</div>
              <div className="step-title">Post the job</div>
              <div className="step-body">
                Copy the scope from your CRM or estimating tool. Set the payout
                you&rsquo;ve already calculated. Add a start date and any
                job-specific instructions. Done in minutes.
              </div>
            </div>
            <div className="step-card" data-num="02">
              <div className="step-icon icon-green">👥</div>
              <div className="step-title">Invite your subs</div>
              <div className="step-body">
                Choose which subs to send it to. They get notified instantly,
                review every detail, and accept with one tap. First to accept
                wins — no double-booking, ever.
              </div>
            </div>
            <div className="step-card" data-num="03">
              <div className="step-icon icon-dark">✅</div>
              <div className="step-title">Track and pay</div>
              <div className="step-body">
                Watch job status update in real time. When it&rsquo;s done,
                earnings update immediately. Full visibility from posted to paid
                — no spreadsheets, no chasing.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-num">
              96<span className="unit">min</span>
            </div>
            <div className="stat-desc">
              <strong>lost every single day</strong> by the average small
              business owner — mostly waiting on status updates and
              context-switching between tools.
            </div>
            <div className="stat-source">
              Slack / Salesforce Small Business Productivity Study, 2024
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-num">
              36<span className="unit">%</span>
            </div>
            <div className="stat-desc">
              <strong>of U.S. small businesses</strong> already use independent
              contractors as part of their workforce. Managing them well is the
              edge.
            </div>
            <div className="stat-source">
              MBO Partners State of Independence Report, 2023
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-num">
              5<span className="unit">wks</span>
            </div>
            <div className="stat-desc">
              <strong>lost per year</strong> to app-switching and status chasing.
              Kolrabee sits alongside your stack — it doesn&rsquo;t replace it.
            </div>
            <div className="stat-source">
              Productivity Research via Cin7, 2024
            </div>
          </div>
        </div>
      </div>

      <section className="workflow-section" id="workflow">
        <div className="container">
          <div className="section-tag">The missing piece</div>
          <h2 className="section-title">
            Your CRM wins the job.
            <br />
            We deliver it.
          </h2>
          <p className="section-body">
            You already have great tools for estimating and managing customers.
            What&rsquo;s missing is a simple, reliable layer between winning the
            job and getting it done right.
          </p>
          <div className="workflow-card">
            <div>
              <div className="workflow-title">
                One layer.
                <br />
                <span>Massive impact.</span>
              </div>
              <div className="workflow-body">
                You&rsquo;ve got tools that close jobs. Tools that track
                customers. But the moment a job goes to a sub — it disappears
                into a text thread and a prayer.
                <br />
                <br />
                Kolrabee is the bridge between your CRM and your crew.
              </div>
            </div>
            <div className="workflow-steps">
              <div className="ws">
                <div className="ws-num">1</div>
                <div className="ws-text">
                  <strong>Win the job</strong> in your CRM — PaintScout, Jobber,
                  DripJobs, LMN, whatever you use
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">2</div>
                <div className="ws-text">
                  <strong>Copy the work order</strong> into Kolrabee with payout
                  already calculated
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">3</div>
                <div className="ws-text">
                  <strong>Invite your subs</strong> — they see every detail and
                  accept instantly from their phone
                </div>
              </div>
              <div className="ws">
                <div className="ws-num">4</div>
                <div className="ws-text">
                  <strong>Track and pay</strong> — full visibility from accepted
                  to complete to paid
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
            No bloated software. No steep learning curve. Just the tools a small
            trade business owner actually needs to dispatch subs and get on with
            their day.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <div className="feature-title">Job Posting</div>
              <div className="feature-body">
                Post jobs with full scope, payout, and start date. Pull straight
                from your CRM — no double entry, no missed instructions.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <div className="feature-title">Race-Proof Assignments</div>
              <div className="feature-body">
                Two subs accept simultaneously? Only one wins. No
                double-booking. No awkward calls. The system handles it
                automatically.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <div className="feature-title">Acceptance Tracking</div>
              <div className="feature-body">
                See who accepted, who passed, and the full status of every job in
                real time. Always know exactly where things stand.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <div className="feature-title">YTD Earnings</div>
              <div className="feature-body">
                Subs see their year-to-date earnings front and center.
                Transparent, motivating, and it keeps your best people coming
                back.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <div className="feature-title">Multi-Company</div>
              <div className="feature-body">
                Running more than one trade business? Each gets its own workspace
                and URL. Clean, separate, and built to scale with you.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <div className="feature-title">Mobile First</div>
              <div className="feature-body">
                Your subs live on their phones. Accept jobs, check pay, review
                job details — from anywhere, instantly.
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
            Stop losing jobs in text threads. Start building a business that runs
            without you being the bottleneck.
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
