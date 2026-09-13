import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import Retro from '../models/Retro.js'
import {
  buildPrompt,
  extractClaims,
  previousRetro
} from '../controllers/retroController.js'
import { authHeader, joinTeam, makeStandup, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const LAST_REPORT = [
  '**🚀 Shipped this week**',
  '- The checkout flow landed, driven by Sara',
  '',
  '**🔁 Recurring blockers**',
  '- Staging credentials, second week running',
  '',
  '**⚠️ Watch list for next week**',
  '- Rohit has been blocked three days and his mood is dropping',
  '',
  '**🎯 Action items**',
  '1. Chase the vendor for staging access',
  '2. Pair Rohit with Sara on the retry logic',
  '3. Book a check-in with Neha'
].join('\n')

const week = {
  weekStart: '2026-06-08',
  weekEnd: '2026-06-12',
  weekLabel: 'Week 24 · Jun 8–12'
}

const stats = {
  submissions: 20,
  activeMembers: 4,
  totalMembers: 5,
  participationRate: 80,
  blockerCount: 3,
  moodBreakdown: { good: 12, okay: 5, bad: 3 },
  byMember: { Sara: 5, Rohit: 5, Neha: 5, Arjun: 5 }
}

const promptFor = (lastRetro) =>
  buildPrompt({
    teamName: 'Platform',
    week,
    standups: [],
    stats,
    previousBlockers: [],
    lastRetro
  })

describe('extractClaims', () => {
  it('keeps what the report promised and drops what it merely summarised', () => {
    const claims = extractClaims(LAST_REPORT)

    expect(claims).toContain('Chase the vendor for staging access')
    expect(claims).toContain('Rohit has been blocked three days')
    // Last week's summary is not a claim about this week, and quoting it back
    // only invites the model to summarise it again
    expect(claims).not.toContain('The checkout flow landed')
  })

  it('falls back to the whole report when the headings are unfamiliar', () => {
    // An older report should still be held to what it said
    const older = '**Summary**\n- Everything was fine\n\n**Next steps**\n- Fix the build'

    expect(extractClaims(older)).toContain('Fix the build')
  })

  it('returns nothing for an empty report', () => {
    expect(extractClaims('')).toBe('')
    expect(extractClaims(undefined)).toBe('')
  })

  it('bounds what it hands to the model', () => {
    const huge = '**🎯 Action items**\n' + '- do a thing\n'.repeat(2000)

    expect(extractClaims(huge).length).toBeLessThanOrEqual(2000)
  })
})

describe('the prompt', () => {
  it('quotes last week\'s promises and asks what became of them', () => {
    const prompt = promptFor({ weekStart: '2026-06-01', content: LAST_REPORT })

    expect(prompt).toContain('Chase the vendor for staging access')
    expect(prompt).toContain('**🔎 Since last week**')
    expect(prompt).toContain('2026-06-01')
    // The evidence has to come from the standups, not from the model
    expect(prompt).toMatch(/do not invent an outcome/i)
  })

  it('says plainly when there is nothing to check', () => {
    const prompt = promptFor(null)

    expect(prompt).toContain('No retrospective was written last week.')
    expect(prompt).toContain('first retrospective for this team')
  })

  it('still asks for every section it asked for before', () => {
    const prompt = promptFor(null)

    for (const heading of [
      'Shipped this week',
      'Recurring blockers',
      'Participation',
      'Mood & morale',
      'Watch list for next week',
      'Action items'
    ]) {
      expect(prompt).toContain(heading)
    }
  })
})

describe('previousRetro', () => {
  it('finds the report for the week before', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'Platform' })

    await Retro.create({
      team: team._id,
      teamName: 'Platform',
      weekStart: '2026-06-01',
      weekEnd: '2026-06-05',
      weekLabel: 'Week 23 · Jun 1–5',
      content: LAST_REPORT
    })

    const found = await previousRetro(team._id, week)

    expect(found?.weekStart).toBe('2026-06-01')
    expect(found?.content).toContain('Chase the vendor')
  })

  it('returns nothing when last week was never written up', async () => {
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager, { name: 'Quiet' })

    expect(await previousRetro(team._id, week)).toBeNull()
  })

  it('does not reach into another team\'s report', async () => {
    const mine = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Mine' })
    const theirs = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Theirs' })

    await Retro.create({
      team: theirs._id,
      teamName: 'Theirs',
      weekStart: '2026-06-01',
      weekEnd: '2026-06-05',
      weekLabel: 'Week 23',
      content: LAST_REPORT
    })

    expect(await previousRetro(mine._id, week)).toBeNull()
  })
})

describe('the retro endpoint', () => {
  it('refuses a week with nothing in it rather than inventing one', async () => {
    const manager = await makeUser({ role: 'manager' })
    await makeTeam(manager, { name: 'Empty' })

    const res = await request(app)
      .post('/api/retro/generate').set(...authHeader(manager))
      .send({ weekStart: '2020-01-06' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/no standups/i)
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()
    const team = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Alpha' })
    await joinTeam(employee, team)
    await makeStandup(employee)

    const res = await request(app)
      .post('/api/retro/generate').set(...authHeader(employee)).send({})

    expect(res.status).toBe(403)
  })
})
