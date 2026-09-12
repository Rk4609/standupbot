const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'onboarding@resend.dev'

// ✅ Reminder email
const sendReminderEmail = async (toEmail, name) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `StandupBot <${FROM_EMAIL}>`,
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

    const { data, error } = await resend.emails.send({
      from: `StandupBot <${FROM_EMAIL}>`,
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
    const { data, error } = await resend.emails.send({
      from: `StandupBot <${FROM_EMAIL}>`,
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

    const { data, error } = await resend.emails.send({
      from: `StandupBot <${FROM_EMAIL}>`,
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
  sendReminderEmail,
  sendManagerSummary,
  sendResetPasswordEmail,
  sendRetroEmail
}