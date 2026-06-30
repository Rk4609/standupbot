const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,    
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
})
// emailService.js mein top pe yeh add karo temporarily
console.log('Email config check:', {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
})

// connection verify on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message)
  } else {
    console.log('✅ Email server ready to send messages')
  }
})

// ✅ Reminder email — member ko
const sendReminderEmail = async (toEmail, name) => {
  await transporter.sendMail({
    from: {
      name: 'StandupBot',
      address: process.env.EMAIL_USER
    },
    to: toEmail,
    subject: `${name}, your daily standup is pending`,
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'StandupBot Mailer',
      'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`
    },
    text: `Hello ${name}, your daily standup has not been submitted yet. Please visit ${process.env.CLIENT_URL}/standup/new to submit it.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Daily Standup Reminder</title>
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">
                🤖 StandupBot
              </h1>
              <p style="margin:4px 0 0; color:#ddd6fe; font-size:13px;">
                Daily Standup Reminder
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <h2 style="margin:0 0 16px; color:#1f2937; font-size:20px;">
                Hello ${name}! 👋
              </h2>

              <p style="margin:0 0 12px; color:#4b5563; font-size:15px; line-height:1.7;">
                Your <strong>daily standup</strong> has not been submitted yet today.
              </p>

              <p style="margin:0 0 24px; color:#4b5563; font-size:15px; line-height:1.7;">
                It only takes <strong>2 minutes</strong> to keep your team updated
                and maintain your streak! 🔥
              </p>

              <!-- Stats Box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f5f3ff; border-radius:8px; margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0; color:#7c3aed; font-size:13px; font-weight:600;">
                      WHY IT MATTERS
                    </p>
                    <ul style="margin:8px 0 0; padding-left:18px; color:#4b5563; font-size:14px; line-height:1.8;">
                      <li>Keep your team aligned and informed</li>
                      <li>Highlight blockers before they slow you down</li>
                      <li>Build your daily streak 🔥</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL}/standup/new"
                      style="display:inline-block; background:#7c3aed; color:#ffffff;
                             text-decoration:none; padding:14px 32px; border-radius:8px;
                             font-size:15px; font-weight:700; letter-spacing:0.3px;">
                      Submit Today's Standup →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#9ca3af; font-size:12px; text-align:center; line-height:1.6;">
                You are receiving this email because you are a member of a StandupBot team.<br/>
                If you have already submitted your standup, please ignore this email.<br/><br/>
                © 2025 StandupBot · All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `,
  })
}

// ✅ EOD Summary email — manager ko
const sendManagerSummary = async (managerEmail, managerName, standups, teamName) => {

  const rows = standups.map(s => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; color:#1f2937; font-size:14px;">
        ${s.user.name}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563; font-size:14px;">
        ${s.today}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; font-size:14px;
                 color:${s.hasBlocker ? '#dc2626' : '#16a34a'};">
        ${s.hasBlocker ? '🚨 ' + s.blockers : '✅ No Blockers'}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563; font-size:14px;">
        ${s.mood}
      </td>
    </tr>
  `).join('')

  await transporter.sendMail({
    from: {
      name: 'StandupBot',
      address: process.env.EMAIL_USER
    },
    to: managerEmail,
    subject: `${teamName} — Daily Standup Summary`,
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'StandupBot Mailer',
      'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`
    },
    text: `Hello ${managerName}, here is today's standup summary for ${teamName}.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Daily Standup Summary</title>
</head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0"
          style="background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">
                🤖 StandupBot
              </h1>
              <p style="margin:4px 0 0; color:#ddd6fe; font-size:13px;">
                ${teamName} — Daily Summary
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <h2 style="margin:0 0 8px; color:#1f2937; font-size:20px;">
                Hello ${managerName}! 👋
              </h2>
              <p style="margin:0 0 24px; color:#4b5563; font-size:15px; line-height:1.7;">
                Here is today's standup report for your team.
              </p>

              <!-- Table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
                <thead>
                  <tr style="background:#f5f3ff;">
                    <th style="padding:12px 16px; text-align:left; color:#7c3aed;
                               font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">
                      Member
                    </th>
                    <th style="padding:12px 16px; text-align:left; color:#7c3aed;
                               font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">
                      Today's Plan
                    </th>
                    <th style="padding:12px 16px; text-align:left; color:#7c3aed;
                               font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">
                      Blockers
                    </th>
                    <th style="padding:12px 16px; text-align:left; color:#7c3aed;
                               font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">
                      Mood
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#9ca3af; font-size:12px; text-align:center; line-height:1.6;">
                This is an automated summary from StandupBot.<br/>
                © 2025 StandupBot · All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `,
  })
}
// ✅ Reset password email
const sendResetPasswordEmail = async (toEmail, name, resetUrl) => {
  await transporter.sendMail({
    from: {
      name: 'StandupBot',
      address: process.env.EMAIL_USER
    },
    to: toEmail,
    subject: 'Reset Your StandupBot Password',
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'StandupBot Mailer'
    },
    text: `Hello ${name}, click this link to reset your password: ${resetUrl}. This link expires in 1 hour. If you didn't request this, please ignore this email.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Password</title>
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">

          <tr>
            <td style="background:#7c3aed; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">
                🤖 StandupBot
              </h1>
              <p style="margin:4px 0 0; color:#ddd6fe; font-size:13px;">
                Password Reset Request
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px; color:#1f2937; font-size:20px;">
                Hello ${name}! 🔒
              </h2>

              <p style="margin:0 0 12px; color:#4b5563; font-size:15px; line-height:1.7;">
                We received a request to reset your password. Click the button below
                to set a new password for your account.
              </p>

              <p style="margin:0 0 24px; color:#4b5563; font-size:15px; line-height:1.7;">
                This link is valid for <strong>1 hour</strong>. If you didn't request
                this, you can safely ignore this email.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                      style="display:inline-block; background:#7c3aed; color:#ffffff;
                             text-decoration:none; padding:14px 32px; border-radius:8px;
                             font-size:15px; font-weight:700;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0; color:#9ca3af; font-size:12px; word-break:break-all;">
                Or copy this link: ${resetUrl}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#9ca3af; font-size:12px; text-align:center; line-height:1.6;">
                If you didn't request a password reset, please ignore this email
                or contact support if you have concerns.<br/><br/>
                © 2025 StandupBot · All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `
  })
}

//  Export update 
module.exports = {
  sendReminderEmail,
  sendManagerSummary,
  sendResetPasswordEmail  
}
