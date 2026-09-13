const { Resend } = require('resend')

/**
 * Resend's shared sandbox sender.
 *
 * It accepts anything and returns a success id, but it only *delivers* to the
 * address the Resend account was registered with. Left as the default, every
 * reminder, every end-of-day summary and every retro looks sent and reaches
 * nobody — which is exactly what was happening.
 */
const SANDBOX_FROM = 'onboarding@resend.dev'

/** `EMAIL_FROM=StandupBot <standups@yourdomain.com>` once a domain is verified. */
const from = () => process.env.EMAIL_FROM || `StandupBot <${SANDBOX_FROM}>`

/** Is this still the sandbox, and therefore going nowhere? */
const usingSandbox = () => from().includes(SANDBOX_FROM)

// Said once per process rather than per email, so it is visible in the logs
// without burying everything else
let warned = false
const warnOnce = () => {
  if (warned || !usingSandbox()) return
  warned = true
  console.warn(
    [
      'EMAIL_FROM is not set, so mail goes out from Resend\'s sandbox address.',
      'Resend only delivers those to the address the account is registered with,',
      'so reminders, summaries and retros will not reach your team.',
      'Verify a domain at resend.com/domains and set EMAIL_FROM.'
    ].join('\n    ')
  )
}

/**
 * The Resend client is built on first use, not at import.
 *
 * Constructing it eagerly threw when RESEND_API_KEY was unset, which took the
 * whole process down at startup — a missing email key should degrade email,
 * not the API. It also made this module unimportable from tests.
 */
let client = null
const getClient = () => {
  if (client) return client
  if (!process.env.RESEND_API_KEY) return null
  client = new Resend(process.env.RESEND_API_KEY)
  return client
}

/** Send, or no-op with a warning when email is not configured. */
const send = async (payload) => {
  const resend = getClient()
  if (!resend) {
    console.warn(`Email skipped (RESEND_API_KEY not set): "${payload.subject}"`)
    return { data: null, error: null }
  }

  warnOnce()
  return resend.emails.send({ ...payload, from: payload.from || from() })
}

// ✅ Reminder email
const sendReminderEmail = async (toEmail, name) => {
  try {
    const { data, error } = await send({
      to: [toEmail],
      subject: '⏰ Daily Standup Reminder',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#7c3aed;">Hello ${name}! 👋</h2>
          <p style="color:#4b5563;">Your daily standup has not been submitted yet today.</p>
          <p style="color:#4b5563;">It only takes <strong>2 minutes</strong> to keep your team updated!</p>
          <a href="${process.env.CLIENT_URL}/standup/new"
             style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;margin-top:16px;font-weight:bold;">
            Submit Standup →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">© 2025 StandupBot</p>
        </div>
      `
    })
    if (error) console.error('Resend reminder error:', error)
    else console.log('✅ Reminder email sent:', data?.id)
  } catch (err) {
    console.error('sendReminderEmail error:', err.message)
  }
}

// ✅ Manager EOD summary
const sendManagerSummary = async (managerEmail, managerName, standups, teamName) => {
  try {
    const rows = standups.map(s => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${s.user.name}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${s.today}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:${s.hasBlocker ? '#dc2626' : '#16a34a'};">
          ${s.hasBlocker ? '🚨 ' + s.blockers : '✅ None'}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${s.mood}</td>
      </tr>
    `).join('')

    const { data, error } = await send({
      to: [managerEmail],
      subject: `📋 ${teamName} — Daily Standup Summary`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;padding:20px;">
          <h2 style="color:#7c3aed;">${teamName} — Daily Summary</h2>
          <p>Hello ${managerName},</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
            <thead>
              <tr style="background:#f5f3ff;">
                <th style="padding:10px;text-align:left;color:#7c3aed;">Member</th>
                <th style="padding:10px;text-align:left;color:#7c3aed;">Today's Plan</th>
                <th style="padding:10px;text-align:left;color:#7c3aed;">Blockers</th>
                <th style="padding:10px;text-align:left;color:#7c3aed;">Mood</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">© 2025 StandupBot</p>
        </div>
      `
    })
    if (error) console.error('Resend summary error:', error)
    else console.log('✅ Manager summary sent:', data?.id)
  } catch (err) {
    console.error('sendManagerSummary error:', err.message)
  }
}

// ✅ Reset password email
const sendResetPasswordEmail = async (toEmail, name, resetUrl) => {
  try {
    console.log('Sending reset email via Resend to:', toEmail)
    const { data, error } = await send({
      to: [toEmail],
      subject: '🔒 Reset Your StandupBot Password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#7c3aed;">Hello ${name}! 🔒</h2>
          <p style="color:#4b5563;">We received a request to reset your StandupBot password.</p>
          <p style="color:#4b5563;">This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#7c3aed;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;margin-top:16px;font-weight:bold;font-size:15px;">
            Reset Password →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">
            If you didn't request this, please ignore this email.<br/>
            © 2025 StandupBot
          </p>
        </div>
      `
    })

    if (error) {
      console.error('❌ Resend reset email error:', error)
      throw new Error(error.message)
    }
    console.log('✅ Reset email sent successfully! ID:', data?.id)
    return data
  } catch (err) {
    console.error('❌ sendResetPasswordEmail error:', err.message)
    throw err
  }
}

// ✅ Weekly retro — plain-text report rendered into the email body
const sendRetroEmail = async (toEmail, managerName, teamName, week, content, stats) => {
  try {
    // The model returns lightweight markdown; convert the few constructs it uses
    const body = content
      .split('\n')
      .map(line => {
        const trimmed = line.trim()
        if (trimmed === '') return '<div style="height:8px"></div>'
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;" />'
        }
        if (/^\*\*.*\*\*$/.test(trimmed)) {
          return `<p style="margin:18px 0 6px;font-size:15px;font-weight:700;color:#111827;">${trimmed.replace(/\*\*/g, '')}</p>`
        }
        const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        if (/^[•\-*]\s/.test(trimmed)) {
          return `<p style="margin:4px 0 4px 16px;font-size:14px;color:#4b5563;">• ${withBold.slice(2)}</p>`
        }
        return `<p style="margin:4px 0;font-size:14px;color:#4b5563;">${withBold}</p>`
      })
      .join('')

    const { data, error } = await send({
      to: [toEmail],
      subject: `🗓️ ${teamName} — Weekly Retro (${week.weekLabel})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;">
          <h2 style="color:#7c3aed;margin:0 0 4px;">${teamName} — Weekly Retro</h2>
          <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">${week.weekLabel}</p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f5f3ff;border-radius:10px;">
            <tr>
              <td style="padding:12px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#7c3aed;">${stats.submissions}</div>
                <div style="font-size:11px;color:#6b7280;">Submissions</div>
              </td>
              <td style="padding:12px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#16a34a;">${stats.participationRate}%</div>
                <div style="font-size:11px;color:#6b7280;">Participation</div>
              </td>
              <td style="padding:12px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:#dc2626;">${stats.blockerCount}</div>
                <div style="font-size:11px;color:#6b7280;">Blockers</div>
              </td>
            </tr>
          </table>

          <p style="color:#4b5563;font-size:14px;">Hello ${managerName},</p>
          ${body}

          <a href="${process.env.CLIENT_URL}/retro"
             style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;margin-top:20px;font-weight:bold;font-size:14px;">
            Open in StandupBot →
          </a>

          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">© 2025 StandupBot</p>
        </div>
      `
    })

    if (error) console.error('Resend retro error:', error)
    else console.log('✅ Retro email sent:', data?.id)
  } catch (err) {
    console.error('sendRetroEmail error:', err.message)
  }
}

module.exports = {
  from,
  usingSandbox,
  // The templated helpers cover the recurring mail; this is for the one-off
  // kind, and it no-ops with a warning when email is not configured
  sendMail: (payload) => send({ ...payload, to: [payload.to] }),
  sendReminderEmail,
  sendManagerSummary,
  sendResetPasswordEmail,
  sendRetroEmail
}