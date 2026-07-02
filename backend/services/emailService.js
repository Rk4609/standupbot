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

module.exports = {
  sendReminderEmail,
  sendManagerSummary,
  sendResetPasswordEmail
}