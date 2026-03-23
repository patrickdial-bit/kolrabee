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

      {/* COMPETITOR BAR */}
      <div className="competitor-bar">
        <div className="comp-item">
          <div className="comp-label">HeyPros Pro+ starts at</div>
          <div className="comp-price theirs">$249</div>
          <div className="comp-name">per month</div>
        </div>
        <div className="comp-vs">VS</div>
        <div className="comp-item">
          <div className="comp-label">Kolrabee Growth starts at</div>
          <div className="comp-price ours">$49</div>
          <div className="comp-name">per month</div>
        </div>
        <div className="comp-note">Same features. Sub ratings, job messaging, completion approvals, file attachments — all included. Five times less.</div>
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
                <li className="plan-section-label">Jobs &amp; Dispatch</li>
                <li>Up to 3 active jobs at a time</li>
                <li>Up to 5 subcontractors</li>
                <li>Multiple jobs per day, different start times</li>
                <li>Job posting with full scope &amp; instructions</li>
                <li>File attachments on job posts (up to 3)</li>
                <li className="plan-section-label">Tracking</li>
                <li>Acceptance tracking in real time</li>
                <li>Job completion confirmation</li>
                <li>YTD earnings for subs</li>
                <li className="plan-section-label">Team</li>
                <li>1 admin user</li>
                <li>1 company workspace</li>
                <li>Mobile access</li>
              </ul>
              <a href="https://www.kolrabee.com/admin/signup" className="plan-cta cta-outline">Start Free</a>
            </div>

            {/* GROWTH */}
            <div className="plan-card featured">
              <div className="plan-badge badge-featured">Most Popular</div>
              <div className="plan-name">Growth</div>
              <div className="plan-price"><sup>$</sup>49</div>
              <div className="plan-period">per month — HeyPros Pro+ is $249</div>
              <div className="plan-for">For owners actively scaling their sub network.</div>
              <div className="plan-divider"></div>
              <ul className="plan-features">
                <li className="plan-section-label">Jobs &amp; Dispatch</li>
                <li className="highlight">Unlimited active jobs</li>
                <li className="highlight">Unlimited subcontractors</li>
                <li>Multiple jobs per day, different start times</li>
                <li>Race-proof assignment engine</li>
                <li>File attachments on job posts (up to 3)</li>
                <li className="plan-section-label">Communication</li>
                <li className="highlight">In-app job messaging (owner &#x2194; sub)</li>
                <li className="plan-section-label">Tracking &amp; Accountability</li>
                <li>Full acceptance tracking</li>
                <li className="highlight">Job completion approval workflow</li>
                <li className="highlight">Sub ratings &amp; performance scores</li>
                <li>YTD earnings for subs</li>
                <li className="plan-section-label">Team</li>
                <li>2 admin users included</li>
                <li>Additional admins: $10/mo each</li>
                <li>1 company workspace</li>
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
                <li className="plan-section-label">Everything in Growth, plus</li>
                <li className="highlight">Up to 5 company workspaces</li>
                <li className="highlight">Separate URLs per company</li>
                <li className="highlight">Consolidated owner dashboard</li>
                <li>All Growth features across every company</li>
                <li className="plan-section-label">Team</li>
                <li>2 admin users included per workspace</li>
                <li>Additional admins: $10/mo each</li>
                <li className="plan-section-label">Support</li>
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
                <th className="col-teal">Growth</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-group"><td colSpan={4}>Jobs &amp; Dispatch</td></tr>
              <tr><td>Active jobs</td><td>3</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Subcontractors</td><td>5</td><td>Unlimited</td><td>Unlimited</td></tr>
              <tr><td>Multiple jobs per day</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Different start times per day</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Day jobs &amp; multi-day jobs</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Race-proof assignments</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>File attachments on jobs</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Communication</td></tr>
              <tr><td>In-app job messaging</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Tracking &amp; Accountability</td></tr>
              <tr><td>Acceptance tracking</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Job completion confirmation</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Job completion approval</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Sub ratings &amp; performance scores</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>YTD earnings dashboard</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Mobile access</td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Team &amp; Admin</td></tr>
              <tr><td>Admin users included</td><td>1</td><td>2</td><td>2 per workspace</td></tr>
              <tr><td>Additional admins</td><td><span className="dash">&mdash;</span></td><td>$10/mo each</td><td>$10/mo each</td></tr>
              <tr className="row-group"><td colSpan={4}>Scale</td></tr>
              <tr><td>Company workspaces</td><td>1</td><td>1</td><td>Up to 5</td></tr>
              <tr><td>Consolidated dashboard</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>Support</td></tr>
              <tr><td>Priority support</td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Dedicated onboarding</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr><td>Early feature access</td><td><span className="dash">&mdash;</span></td><td><span className="dash">&mdash;</span></td><td><span className="check">&#x2713;</span></td></tr>
              <tr className="row-group"><td colSpan={4}>How we compare</td></tr>
              <tr className="heypros-row">
                <td>HeyPros Base — $149/mo</td>
                <td><span className="heypros-val">15 subs max</span></td>
                <td><span className="heypros-val">no ratings, no messaging</span></td>
                <td><span className="heypros-val">&mdash;</span></td>
              </tr>
              <tr className="heypros-row">
                <td>HeyPros Pro+ — $249/mo</td>
                <td><span className="heypros-val">30 subs max</span></td>
                <td><span className="heypros-val">ratings &amp; messaging included</span></td>
                <td><span className="heypros-val">&mdash;</span></td>
              </tr>
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
                How is Kolrabee different from HeyPros?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>HeyPros Pro+ is $249/month and built for compliance tracking, Gantt charts, and complex project management — it&apos;s designed for large GCs. Kolrabee is built for small trade business owners who need fast, simple sub dispatch. Sub ratings, job messaging, file attachments, and completion approvals are all included in our $49 Growth plan. Same features that matter. Five times less cost. No bloat.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Can I post multiple jobs the same day with different start times?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Yes — that&apos;s exactly what Kolrabee is built for. Post as many jobs as your plan allows, each with its own start time, payout, assigned sub, and file attachments. Day jobs, 2-day jobs, multiple crews running simultaneously — all managed from one screen.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                How do sub ratings work?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>After a job is marked complete and approved, you&apos;re prompted to rate the sub 1–5 stars with an optional note. Subs can see their own rating and total job count. You can sort your sub list by rating so your best crew gets first pick on future jobs. Available on Growth and Operator plans.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What is job completion approval?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>When a sub finishes a job they tap &ldquo;Mark Complete&rdquo; in the app. You get notified and tap &ldquo;Approve.&rdquo; Once approved the job closes, the sub&apos;s YTD earnings update, and you&apos;re prompted to leave a rating. It closes the loop cleanly — no ambiguity about whether a job is done or paid.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What files can I attach to a job post?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>You can attach up to 3 files per job — PDF, JPG, or PNG. Subs can view and download the files before they accept. Perfect for attaching work orders, site photos, or job-specific instructions copied from your CRM.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What is an admin user?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>An admin is anyone who logs in to post jobs, invite subs, and manage your workspace — typically you, a VA, or an office manager. Subs are never counted as admins and always access Kolrabee for free.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Can I switch plans anytime?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Yes — upgrade or downgrade anytime. No contracts, no cancellation fees. Changes take effect at the start of your next billing cycle.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                Do I need a credit card to start free?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>No. Start completely free with no credit card required. Only enter billing details when you&apos;re ready to upgrade to Growth or Operator.</p></div>
            </div>
            <div className="faq-item">
              <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget)}>
                What is a company workspace?
                <span className="faq-icon">+</span>
              </button>
              <div className="faq-a"><p>Each trade business you run gets its own workspace with a unique URL, separate crew list, and separate job board. The Operator plan supports up to 5 companies — perfect for owners running a painting company, a landscaping company, or any combination of trades under one account.</p></div>
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
