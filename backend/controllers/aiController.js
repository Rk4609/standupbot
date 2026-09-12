const Standup = require('../models/Standup')
const Team = require('../models/Team')
const User = require('../models/User')
const { streamChat } = require('../services/groqService')

const SYSTEM_PROMPT =
  'You are an expert engineering team manager AI assistant. Provide clear, structured, actionable analysis.'

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

    const filter = { date: today }
    if (teamId) filter.team = teamId

    const standups = await Standup.find(filter).populate('user', 'name streak')

    if (standups.length === 0) {
      return res.status(400).json({
        message: 'No standups found for today. Ask team members to submit first!'
      })
    }

    let totalMembers = standups.length
    if (teamId) {
      const team = await Team.findById(teamId)
      totalMembers = team?.members?.length || standups.length
    } else {
      totalMembers = await User.countDocuments({ role: 'member' })
    }

    const standupData = standups.map(s => ({
      member: s.user.name,
      streak: s.user.streak || 0,
      accomplished_yesterday: s.yesterday,
      plan_for_today: s.today,
      blockers: s.hasBlocker ? s.blockers : 'None',
      mood: s.mood
    }))

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

    await streamChat({ system: SYSTEM_PROMPT, prompt, res, maxTokens: 1500 })
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
