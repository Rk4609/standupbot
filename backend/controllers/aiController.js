const Standup = require('../models/Standup')
const Team = require('../models/Team')
const User = require('../models/User')

// Helper — team ID nikalo
const getTeamId = async (user) => {
  if (user.role === 'member' && user.team) return user.team
  if (user.role === 'manager') {
    const team = await Team.findOne({ manager: user._id })
    return team?._id || null
  }
  return null
}

const analyzeTeam = async (req, res) => {
  try {
    const { date } = req.body
    const today = date || new Date().toISOString().split('T')[0]

    // ✅ Team ID aur name nikalo
    let teamId = await getTeamId(req.user)
    let teamName = 'Your Team'

    if (req.user.role === 'admin' && !teamId) {
      const team = await Team.findOne()
      teamId = team?._id
      teamName = team?.name || 'All Teams'
    } else {
      const team = await Team.findById(teamId)
      teamName = team?.name || 'Your Team'
    }

    // ✅ Standups fetch karo
    const filter = { date: today }
    if (teamId) filter.team = teamId

    const standups = await Standup.find(filter)
      .populate('user', 'name streak')

    if (standups.length === 0) {
      return res.status(400).json({
        message: 'No standups found for today. Ask team members to submit first!'
      })
    }

    // ✅ Total members count
    let totalMembers = standups.length
    if (teamId) {
      const team = await Team.findById(teamId)
      totalMembers = team?.members?.length || standups.length
    } else {
      totalMembers = await User.countDocuments({ role: 'member' })
    }

    // ✅ Standup data prepare karo
    const standupData = standups.map(s => ({
      member: s.user.name,
      streak: s.user.streak || 0,
      accomplished_yesterday: s.yesterday,
      plan_for_today: s.today,
      blockers: s.hasBlocker ? s.blockers : 'None',
      mood: s.mood
    }))

    // ✅ Prompt
    const prompt = `You are an expert engineering team manager AI assistant. Analyze the following daily standup data and provide a comprehensive, actionable team health report.

Team: ${teamName}
Date: ${today}
Submissions: ${standups.length} out of ${totalMembers} members

Standup Data:
${JSON.stringify(standupData, null, 2)}

Provide a structured analysis with these exact sections:

**📊 Team Health Score: X/10**
Brief explanation of the score.

**👥 Participation Summary**
Who submitted and participation rate percentage.

**😊 Mood Analysis**
Overall team sentiment based on mood data.

**🚨 Active Blockers**
List each blocker with Priority: High/Medium/Low and why.

**✅ Key Highlights**
What is going well in the team.

**⚠️ Risk Areas**
Potential issues to watch out for.

**💡 AI Recommendations**
3 specific actionable suggestions for the manager to improve team performance.

Keep tone professional but friendly. Be specific with names. Use bullet points.`

    // ✅ Groq API — Streaming
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          stream: true,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: 'You are an expert engineering team manager AI assistant. Provide clear, structured, actionable analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      }
    )

    if (!groqResponse.ok) {
      const err = await groqResponse.json()
      throw new Error(err.error?.message || 'Groq API error')
    }

    // ✅ SSE headers set karo
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || '*')

    // ✅ Stream read karo aur frontend ko bhejo
    const reader = groqResponse.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n')
            continue
          }
          try {
            const parsed = JSON.parse(data)
            // ✅ Groq format — choices[0].delta.content
            const text = parsed.choices?.[0]?.delta?.content || ''
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`)
            }
          } catch (e) {
            // skip parse errors
          }
        }
      }
    }

    res.end()

  } catch (err) {
    console.error('AI analyze error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'AI analysis failed' })
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
}

module.exports = { analyzeTeam }