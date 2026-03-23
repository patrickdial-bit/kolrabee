'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import './pricing.css'

export default function PricingPage() {
  const observerRef = useRef<IntersectionObserver | null>(null)

  const toggleFaq = useCallback((btn: HTMLButtonElement) => {
    const item = btn.closest('.faq-item')
    if (!item) return
    const isOpen = item.classList.contains('open')
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'))
    if (!isOpen) item.classList.add('open')
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)'
        }
      })
    }, { threshold: 0.1 })

    document.querySelectorAll('.pricing-page .plan-card, .pricing-page .faq-item').forEach(el => {
      const htmlEl = el as HTMLElement
      htmlEl.style.opacity = '0'
      htmlEl.style.transform = 'translateY(20px)'
      htmlEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div className="pricing-page" style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--cream)', color: 'var(--dark)', overflowX: 'hidden' }}>
      {/* NAV */}
      <nav>
        <Link href="/" className="nav-logo"><span className="k">kol</span><span className="r">ra</span><span className="b">bee</span></Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/admin/login">Login</Link>
          <Link href="/admin/signup" className="nav-cta">Get Started Free</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-eyebrow">Simple, transparent pricing</div>
        <h1 className="hero-headline">Pricing as <span>simple</span><br />as the platform.</h1>
        <p className="hero-sub">No hidden fees. No long-term contracts. <strong>Start free and scale when you&apos;re ready.</strong></p>
      </div>

      {/* COMPETITOR CALLOUT */}
      <div className="competitor-bar">
        <div className="comp-item">
          <div className="comp-platform">HeyPros</div>
          <div className="comp-price theirs">$149<span style={{ fontSize: '18px' }}>/mo</span></div>
          <div className="comp-note">Base plan, 1 staff user</div>
        </div>
        <div className="comp-arrow">&rarr;</div>
        <div className="comp-item">
          <div className="comp-platform">Kolrabee</div>
          <div className="comp-price ours">$49<span style={{ fontSize: '18px' }}>/mo</span></div>
          <div className="comp-note">Growth plan, unlimited jobs</div>
        </div>
        <div className="comp-badge">Same dispatch. 3x less.</div>
      </div>

      {/* PRICING CARDS */}
      <section className="pricing-section">
        <div className="container">
          <div className="pricing-grid">
            {/* FREE */}
            <div className="plan-card">
              <div className="plan-badge badge-free">Starter</div>
              <div className="plan-name">Free</div>
              <div className="plan-price">$0</div>
              <div className="plan-period">forever</div>
              <div className="plan-for">For owners getting started — no credit card required.</div>
              <div className="plan-divider"></div>
              <ul className="plan-features">
                <li>Up to 3 active jobs at a time</li>
                <li>Up to 5 subcontractors</li>
                <li>Job posting and acceptance tracking</li>
                <li>YTD earnings for subs</li>
                <li>Mobile access</li>
                <li>1 admin user</li>
                <li>1 company workspace</li>
              </ul>
              <a href="https://www.kolrabee.com/admin/signup" className="plan-cta cta-outline">Start Free</a>
            </div>

            {/* GROWTH */}
            <div className="plan-card featured">
              <div className="plan-badge badge-featured">Most Popular</div>
              <div className="plan-name">Growth</div>
              <div className="plan-price"><sup>$</sup>49</div>
              <div className="plan-period">per month</div>
              <div className="plan-for">For owners actively dispatching jobs and scaling their crew.</div>
              <div className="plan-divider"></div>
              <ul className="plan-features">
                <li>Unlimited active jobs</li>
                <li>Unlimited subcontractors</li>
                <li>Multiple jobs same day — different subs, different start times</li>
                <li>Everything in Free</li>
                <li>Race-proof assignment engine</li>
                <li>Full acceptance tracking</li>
                <li>2 admin users included</li>
                <li>Additional admins: $10/mo each</li>
                <li>Priority support</li>
              </ul>
              <a href="https://www.kolrabee.com/admin/signup" className="plan-cta cta-teal">Start Growth</a>
            </div>

            {/* OPERATOR */}
            <div className="plan-card dark-card">
              <div className="plan-badge badge-dark">Operator</div>
              <div className="plan-name">Operator</div>
              <div className="plan-price"><sup>$</sup>99</div>
              <div className="plan-period">per month</div>
              <div className="plan-for">For owners running multiple trade businesses.</div>
              <div className="plan-divider"></div>
              <ul className="plan-features">
                <li>Everything in Growth</li>
                <li>Up to 5 company workspaces</li>
                <li>Separate URLs per company</li>
                <li>Consolidated owner dashboard</li>
                <li>2 admin users included</li>
                <li>Additional admins: $10/mo each</li>
                <li>Early access to new features</li>
                <li>Dedicated onboarding support</li>
              </ul>
              <a href="https://www.kolrabee.com/admin/signup" className="plan-cta cta-white">Start Operator</a>
            </div>
          </div>
          <p className="plans-note">Subs always use Kolrabee <strong>completely free</strong>. No exceptions, no surprises.</p>
        </div>
      </section>

      {/* COMPARE TABLE */}
      <section className="compare-section">
        <div className="container">
          <div className="section-tag">Compare plans</div>
          <h2 className="section-title">Everything<br />side by side.</h2>
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th>Free</th>
                <th className="col-featured">Growth</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-group"><td colSpan={4}>Jobs &amp; Subs</td></tr>
              <tr><td>Active jobs</td><td>3</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Subcontractors</td><td>5</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Same-day multi-job dispatch</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Individual start times per job</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Core Features</td></tr>
              <tr><td>Job posting</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Acceptance tracking</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>YTD earnings dashboard</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Mobile access</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Race-proof assignments</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Team &amp; Admin</td></tr>
              <tr><td>Admin users included</td><td>1</td><td>2</td><td>2</td></tr>
              <tr><td>Additional admins</td><td><span className="dash">&mdash;</span></td><td>$10/mo each</td><td>$10/mo each</td></tr>
              <tr className="row-group"><td colSpan={4}>Scale</td></tr>
              <tr><td>Company workspaces</td><td>1</td><td>1</td><td>Up to 5</td></tr>
              <tr><td>Consolidated dashboard</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Support</td></tr>
              <tr><td>Priority support</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Dedicated onboarding</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Early feature access</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <div className="section-tag">Questions</div>
          <h2 className="section-title">Straight<br />answers.</h2>
          <div className="faq-list">
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Do subs ever pay to use Kolrabee?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Never. Subs always use Kolrabee completely free. Only the business owner pays for a plan. This will never change.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Can I run multiple jobs on the same day with different subs?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Yes — this is exactly what Kolrabee is built for. On the Growth plan you can post unlimited jobs simultaneously, each with their own sub, start time, scope, and payout. Day jobs, two-day jobs, full weeks of back-to-back dispatching — all managed in one place.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What is an admin user?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>An admin is anyone who logs in to post jobs, invite subs, and manage your workspace — typically you, a VA, or an office manager. Subs are never counted as admins.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What counts as an active job?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Any job that has been posted and not yet marked complete. Once a job is closed and paid, it no longer counts toward your limit. Free plan users can have 3 active jobs at any time.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                How is Kolrabee different from HeyPros?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>HeyPros is built for complex compliance tracking, Gantt schedules, and enterprise workflows — and starts at $149/month. Kolrabee is built for speed: post a job, subs accept in minutes, job runs tomorrow. No bloat, no learning curve, and our Growth plan is $49/month. If you&apos;re running short-duration jobs with multiple subs across the week, Kolrabee is the faster, simpler, cheaper choice.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Can I switch plans?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Yes — upgrade or downgrade anytime. No contracts, no cancellation fees. Changes take effect at the start of your next billing cycle.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Do I need a credit card to start free?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>No. Start completely free with no credit card required. Only enter billing details when you&apos;re ready to upgrade.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-title">Start free.<br /><span>Scale</span> when you&apos;re ready.</div>
          <p className="cta-sub">Your first job takes less than 5 minutes to post.</p>
          <a href="https://www.kolrabee.com/admin/signup" className="btn-big">Get Started Free</a>
          <p className="cta-note">No credit card required. Subs always free.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <Link href="/" className="footer-logo"><span className="k">kol</span><span className="r">ra</span><span className="b">bee</span></Link>
        <p>&copy; 2026 Kolrabee. All rights reserved.</p>
      </footer>
    </div>
  )
}
