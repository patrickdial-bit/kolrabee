#!/usr/bin/env python3
"""
CEO Daily Briefing — EOS-Framed Edition
Sends a daily AI-generated executive briefing with EOS methodology framing.
Includes a rotating daily EOS tip targeting four key pain points.
"""

import datetime
import json
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import anthropic

# ── Settings ────────────────────────────────────────────────────────────────
SENDER_EMAIL = "patrickdial.briefing@gmail.com"
RECIPIENT_EMAIL = "patrick.dial@midwest-investments.com"
ANTHROPIC_KEY_PATH = Path.home() / ".anthropic_key"
GMAIL_APP_PASSWORD_PATH = Path.home() / ".gmail_app_password"
GOOGLE_CREDENTIALS_PATH = Path.home() / ".google_credentials.json"

# ── EOS Pain-Point Tips (rotating daily) ────────────────────────────────────
EOS_TIPS = [
    # Pain Point 1: GM Accountability / Delegation
    {
        "category": "GM Accountability & Delegation",
        "tip": (
            "Delegate and Elevate: Are your GMs truly owning their Rocks, or are you "
            "still solving problems that belong on their Issues List? In EOS, the "
            "Accountability Chart makes it crystal clear — every seat has roles, and "
            "the person in the seat must GWC (Get it, Want it, Capacity to do it). "
            "If a GM isn't owning their numbers on the Scorecard, IDS the root cause "
            "in your next L10: Is it the right person? The right seat? Or a lack of "
            "clear measurables?"
        ),
    },
    # Pain Point 2: Cash Flow / SBA Exposure
    {
        "category": "Cash Flow & SBA Exposure",
        "tip": (
            "Cash is oxygen. In your V/TO, financial targets aren't aspirational — "
            "they're Rocks with hard deadlines. Make sure your Scorecard tracks weekly "
            "cash-on-hand, SBA covenant ratios, and days-sales-outstanding. If cash "
            "flow is dropping, don't wait for month-end — IDS it immediately in your "
            "L10. Identify the real issue (revenue timing? expense creep? draw-down "
            "schedule?), Discuss options, and Solve with a concrete To-Do due in 7 days."
        ),
    },
    # Pain Point 3: People / Compensation Issues
    {
        "category": "People & Compensation",
        "tip": (
            "Right People, Right Seats. EOS teaches that people issues are business "
            "issues. Use the People Analyzer against your Core Values and GWC to "
            "evaluate whether compensation gaps are a 'right person' problem or a "
            "'right seat' problem. If someone is below the bar on Core Values, no "
            "comp adjustment fixes it. If they GWC the seat but pay is misaligned, "
            "that's a Rock for this quarter: build a comp framework that retains your "
            "A-players before the market does it for you."
        ),
    },
    # Pain Point 4: Marketing / Lead Generation
    {
        "category": "Marketing & Lead Gen",
        "tip": (
            "Your marketing engine needs a Scorecard number — not just 'more leads' "
            "but a specific, measurable weekly activity metric (e.g., qualified leads "
            "per week, cost-per-acquisition, conversion rate). Set a quarterly Rock to "
            "build or fix your lead-gen system. In your L10, IDS any week where the "
            "number is off-track. Remember the V/TO: your 3-Year Picture should "
            "define your ideal customer and channel mix. If marketing can't articulate "
            "that, the issue is strategic, not tactical."
        ),
    },
]

# ── Briefing Prompt ─────────────────────────────────────────────────────────
BRIEFING_SYSTEM_PROMPT = """\
You are an executive briefing assistant for a CEO who runs a portfolio of \
businesses using the EOS (Entrepreneurial Operating System) framework. \
Frame everything in EOS language and structure.

When generating the briefing, use these EOS concepts naturally:
- **Rocks**: Quarterly priorities / 90-day goals
- **Scorecard**: Weekly measurables and KPIs
- **IDS**: Identify, Discuss, Solve — the issue-resolution process
- **L10**: Level 10 Meeting — the weekly leadership meeting
- **GWC**: Get it, Want it, Capacity to do it — people evaluation
- **V/TO**: Vision/Traction Organizer — the strategic plan
- **Accountability Chart**: Who owns what

Structure the briefing with these sections:
1. **Executive Pulse** — Top 3 things the CEO needs to know today
2. **Scorecard Check** — Key numbers and trends to watch this week
3. **Rock Status** — Any quarterly priorities at risk or needing attention
4. **Issues List** — Items to IDS in the next L10
5. **Market & Industry Intel** — External signals relevant to the portfolio
6. **Today's Focus** — The 1-2 highest-leverage actions for today

Keep it concise, direct, and actionable. No fluff. Write for a busy CEO \
who has 5 minutes to read this over coffee."""


def load_secret(path: Path) -> str:
    """Read a single-line secret from a file."""
    return path.read_text().strip()


def get_todays_tip() -> dict:
    """Return the EOS tip for today based on day-of-year rotation."""
    day_of_year = datetime.date.today().timetuple().tm_yday
    return EOS_TIPS[day_of_year % len(EOS_TIPS)]


def generate_briefing(api_key: str) -> str:
    """Call Claude to generate the daily CEO briefing."""
    client = anthropic.Anthropic(api_key=api_key)
    today = datetime.date.today().strftime("%A, %B %d, %Y")
    tip = get_todays_tip()

    user_prompt = f"""\
Generate my CEO daily briefing for {today}.

Also include this EOS Tip of the Day at the end of the briefing:

**EOS Tip of the Day — {tip['category']}**
{tip['tip']}

Make the briefing feel current and relevant. Focus on actionable intelligence."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=BRIEFING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text


def send_email(subject: str, body: str, app_password: str) -> None:
    """Send the briefing via Gmail SMTP."""
    msg = MIMEMultipart("alternative")
    msg["From"] = SENDER_EMAIL
    msg["To"] = RECIPIENT_EMAIL
    msg["Subject"] = subject

    # Send as plain text
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(SENDER_EMAIL, app_password)
        server.sendmail(SENDER_EMAIL, RECIPIENT_EMAIL, msg.as_string())


def main():
    print("=" * 60)
    print("CEO Daily Briefing — EOS Edition")
    print("=" * 60)

    # Load secrets
    print("\n[1/3] Loading credentials...")
    api_key = load_secret(ANTHROPIC_KEY_PATH)
    app_password = load_secret(GMAIL_APP_PASSWORD_PATH)
    print("  OK — Anthropic key and Gmail app password loaded.")

    # Generate briefing
    today_str = datetime.date.today().strftime("%A, %B %d, %Y")
    print(f"\n[2/3] Generating briefing for {today_str}...")
    briefing = generate_briefing(api_key)
    print("  OK — Briefing generated.\n")
    print("-" * 60)
    print(briefing)
    print("-" * 60)

    # Send email
    subject = f"CEO Briefing — {today_str}"
    print(f"\n[3/3] Sending to {RECIPIENT_EMAIL}...")
    send_email(subject, briefing, app_password)
    print("  OK — Email sent successfully.")

    print("\n" + "=" * 60)
    print("Done.")
    print("=" * 60)


if __name__ == "__main__":
    main()
