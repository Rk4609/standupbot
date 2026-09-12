import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import AuditLog from '../models/AuditLog.js'
import Project from '../models/Project.js'
import StandupTemplate from '../models/StandupTemplate.js'
import Team from '../models/Team.js'
import Timesheet from '../models/Timesheet.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Monday of a week well clear of any other test's dates. */
const MONDAY = '2026-06-01'
const TUESDAY = '2026-06-02'

/** Freeze the clock on a day inside that week. */
const onTuesday = () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TUESDAY}T09:00:00.000Z`))
}

const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  const member = await joinTeam(await makeUser({ name: 'Booker' }), team)
  return { manager, team, member }
}

const makeProject = (overrides = {}) =>
  Project.create({ name: 'Acme rebuild', client: 'Acme', ...overrides })

const submitStandup = (user, body) =>
  request(app).post('/api/standups').set(...authHeader(user)).send({
    yesterday: 'a',
    today: 'b',
    ...body
  })

describe('the project catalogue', () => {
  it('offers a team its own projects and the shared ones', async () => {
    const { team, member } = await withTeam()
    await makeProject({ name: 'Team work', team: team._id })
    await makeProject({ name: 'Internal', team: null })
    const otherTeam = await makeTeam(await makeUser({ role: 'manager' }), { name: 'Other' })
    await makeProject({ name: 'Someone else', team: otherTeam._id })

    const res = await request(app).get('/api/projects').set(...authHeader(member))

    const names = res.body.map(p => p.name)
    expect(names).toContain('Team work')
    // Leave, training and internal work belong to nobody but everyone books
    // to them, or a week never adds up
    expect(names).toContain('Internal')
    expect(names).not.toContain('Someone else')
  })

  it('leaves an archived project out of the pickable list', async () => {
    const { team, member } = await withTeam()
    await makeProject({ name: 'Finished', team: team._id, active: false })

    const res = await request(app).get('/api/projects').set(...authHeader(member))
    expect(res.body.map(p => p.name)).not.toContain('Finished')
  })

  it('lets a manager create one for their own team only', async () => {
    const { manager, team } = await withTeam()

    const mine = await request(app).post('/api/projects').set(...authHeader(manager))
      .send({ name: 'New build', client: 'Acme' })
    expect(mine.status).toBe(201)
    expect(String(mine.body.team)).toBe(String(team._id))

    const other = await withTeam()
    const theirs = await request(app).post('/api/projects').set(...authHeader(manager))
      .send({ name: 'Reaching', team: String(other.team._id) })
    expect(theirs.status).toBe(400)
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()
    const res = await request(app).post('/api/projects').set(...authHeader(employee))
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('shows a lead how much has been booked before they archive something', async () => {
    const { manager, team, member } = await withTeam()
    const project = await makeProject({ name: 'In use', team: team._id })

    onTuesday()
    await submitStandup(member, { work: [{ project: String(project._id), hours: 3 }] })
    vi.useRealTimers()

    const res = await request(app).get('/api/projects/all').set(...authHeader(manager))
    const row = res.body.projects.find(p => p.name === 'In use')
    expect(row.hours).toBe(3)
    expect(row.entries).toBe(1)
  })
})

describe('booking hours on a standup', () => {
  it('stores them against the day', async () => {
    const { team, member } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    const res = await submitStandup(member, {
      work: [{ project: String(project._id), hours: 4.5, note: 'Checkout flow' }]
    })

    expect(res.status).toBe(201)
    expect(res.body.work).toHaveLength(1)
    expect(res.body.work[0].hours).toBe(4.5)
  })

  it('refuses a project the person cannot book to', async () => {
    const { member } = await withTeam()
    const other = await withTeam()
    const theirs = await makeProject({ name: 'Not yours', team: other.team._id })

    onTuesday()
    const res = await submitStandup(member, {
      work: [{ project: String(theirs._id), hours: 2 }]
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/not available/i)
  })

  it('refuses an archived project, which is what archiving is for', async () => {
    const { team, member } = await withTeam()
    const closed = await makeProject({ team: team._id, active: false })

    onTuesday()
    const res = await submitStandup(member, {
      work: [{ project: String(closed._id), hours: 2 }]
    })

    expect(res.status).toBe(400)
  })

  it('refuses more hours than there are in a day', async () => {
    const { team, member } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    const res = await submitStandup(member, {
      work: [
        { project: String(project._id), hours: 20 },
        { project: String(project._id), hours: 10 }
      ]
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/30 hours/)
  })

  it('requires hours when the team tracks time', async () => {
    const { team, member } = await withTeam()
    await StandupTemplate.create({
      team: team._id,
      questions: [{ key: 'yesterday', label: 'Y', required: false },
        { key: 'today', label: 'T', required: true },
        { key: 'blockers', label: 'B', required: false }],
      trackTime: true
    })

    onTuesday()
    const res = await submitStandup(member, {})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/where your hours went/i)
  })

  it('does not ask for hours from a team that does not track time', async () => {
    const { member } = await withTeam()

    onTuesday()
    const res = await submitStandup(member, {})

    expect(res.status).toBe(201)
    expect(res.body.work).toEqual([])
  })
})

describe('my week', () => {
  it('adds the days up by project', async () => {
    const { team, member } = await withTeam()
    const acme = await makeProject({ name: 'Acme', team: team._id })
    const internal = await makeProject({ name: 'Internal', team: null, billable: false })

    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${MONDAY}T09:00:00.000Z`))
    await submitStandup(member, {
      work: [
        { project: String(acme._id), hours: 6 },
        { project: String(internal._id), hours: 2 }
      ]
    })
    vi.setSystemTime(new Date(`${TUESDAY}T09:00:00.000Z`))
    await submitStandup(member, { work: [{ project: String(acme._id), hours: 7 }] })
    vi.useRealTimers()

    const res = await request(app)
      .get(`/api/timesheets/me?weekStart=${MONDAY}`).set(...authHeader(member))

    expect(res.status).toBe(200)
    expect(res.body.totalHours).toBe(15)
    // Non-billable work still has to be recorded, but must not be billed
    expect(res.body.billableHours).toBe(13)

    const acmeRow = res.body.lines.find(l => l.name === 'Acme')
    expect(acmeRow.total).toBe(13)
    expect(acmeRow.perDay[MONDAY]).toBe(6)
    expect(acmeRow.perDay[TUESDAY]).toBe(7)
    expect(res.body.perDayTotals[MONDAY]).toBe(8)
  })

  it('always has five columns, so an empty day is visible', async () => {
    const { member } = await withTeam()

    const res = await request(app)
      .get(`/api/timesheets/me?weekStart=${MONDAY}`).set(...authHeader(member))

    expect(res.body.dates).toHaveLength(5)
    expect(res.body.dates[0]).toBe(MONDAY)
  })

  it('starts as a draft', async () => {
    const { member } = await withTeam()

    const res = await request(app)
      .get(`/api/timesheets/me?weekStart=${MONDAY}`).set(...authHeader(member))

    expect(res.body.status).toBe('draft')
  })

  it('snaps any date in the week back to its Monday', async () => {
    const { member } = await withTeam()

    const res = await request(app)
      .get('/api/timesheets/me?weekStart=2026-06-04').set(...authHeader(member))

    expect(res.body.week.weekStart).toBe(MONDAY)
  })
})

describe('submitting a week', () => {
  const bookAndSubmit = async () => {
    const ctx = await withTeam()
    const project = await makeProject({ team: ctx.team._id })

    onTuesday()
    await submitStandup(ctx.member, { work: [{ project: String(project._id), hours: 8 }] })
    vi.useRealTimers()

    const res = await request(app).post('/api/timesheets/submit')
      .set(...authHeader(ctx.member)).send({ weekStart: MONDAY })

    return { ...ctx, project, res }
  }

  it('records the total as it stood', async () => {
    const { res } = await bookAndSubmit()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('submitted')
    expect(res.body.totalHours).toBe(8)
  })

  it('refuses an empty week rather than sending a manager nothing to review', async () => {
    const { member } = await withTeam()

    const res = await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/no hours/i)
  })

  it('cannot be resubmitted once approved', async () => {
    const { member, manager } = await bookAndSubmit()
    await request(app).patch(`/api/timesheets/${member._id}`).set(...authHeader(manager))
      .send({ weekStart: MONDAY, action: 'approve' })

    const again = await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })

    expect(again.status).toBe(400)
    expect(again.body.message).toMatch(/already approved/i)
  })
})

describe('reviewing a week', () => {
  const setup = async () => {
    const ctx = await withTeam()
    const project = await makeProject({ team: ctx.team._id })

    onTuesday()
    await submitStandup(ctx.member, { work: [{ project: String(project._id), hours: 8 }] })
    vi.useRealTimers()

    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(ctx.member)).send({ weekStart: MONDAY })

    return { ...ctx, project }
  }

  const review = (manager, member, body) =>
    request(app).patch(`/api/timesheets/${member._id}`).set(...authHeader(manager))
      .send({ weekStart: MONDAY, ...body })

  it('approves', async () => {
    const { manager, member } = await setup()

    const res = await review(manager, member, { action: 'approve' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
  })

  it('will not send a week back without saying why', async () => {
    const { manager, member } = await setup()

    const bare = await review(manager, member, { action: 'request_changes' })
    expect(bare.status).toBe(400)
    expect(bare.body.message).toMatch(/what needs changing/i)

    const withReason = await review(manager, member, {
      action: 'request_changes',
      note: 'Friday is missing'
    })
    expect(withReason.status).toBe(200)
    expect(withReason.body.note).toBe('Friday is missing')
  })

  it('leaves a trail, since approving a week is a decision about pay', async () => {
    const { manager, member } = await setup()
    await review(manager, member, { action: 'approve' })

    const [entry] = await AuditLog.find({ action: 'timesheet.reviewed' })
      .sort({ createdAt: -1 }).limit(1).lean()

    expect(entry.subjectName).toBe('Booker')
    expect(entry.changes[0]).toEqual({ field: 'status', from: 'submitted', to: 'approved' })
  })

  it('refuses a week that was never submitted', async () => {
    const { manager, member } = await withTeam()

    const res = await review(manager, member, { action: 'approve' })
    expect(res.status).toBe(404)
  })

  it('will not let a manager review another team', async () => {
    const { member } = await setup()
    const outsider = (await withTeam()).manager

    const res = await review(outsider, member, { action: 'approve' })
    expect(res.status).toBe(404)
  })

  it('will not let anyone approve their own week', async () => {
    const admin = await makeUser({ role: 'admin' })
    const project = await makeProject({ team: null })

    onTuesday()
    await submitStandup(admin, { work: [{ project: String(project._id), hours: 8 }] })
    vi.useRealTimers()
    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(admin)).send({ weekStart: MONDAY })

    const res = await request(app).patch(`/api/timesheets/${admin._id}`)
      .set(...authHeader(admin)).send({ weekStart: MONDAY, action: 'approve' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/your own week/i)
  })

  it('is closed to employees', async () => {
    const { member } = await setup()
    const other = await makeUser()

    const res = await request(app).patch(`/api/timesheets/${member._id}`)
      .set(...authHeader(other)).send({ weekStart: MONDAY, action: 'approve' })

    expect(res.status).toBe(403)
  })
})

describe('the team view', () => {
  it('flags a week edited after it was submitted', async () => {
    const { manager, member, team } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    const standup = await submitStandup(member, {
      work: [{ project: String(project._id), hours: 8 }]
    })
    vi.useRealTimers()

    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })

    // The hours change underneath the snapshot
    const { default: Standup } = await import('../models/Standup.js')
    await Standup.updateOne({ _id: standup.body._id }, { 'work.0.hours': 2 })

    const res = await request(app)
      .get(`/api/timesheets?weekStart=${MONDAY}`).set(...authHeader(manager))

    const row = res.body.people.find(p => String(p._id) === String(member._id))
    // A reviewer approving 8 hours that are now 2 is the one thing that
    // must not pass silently
    expect(row.changedSinceSubmit).toBe(true)
    expect(row.totalHours).toBe(2)
    expect(row.submittedTotal).toBe(8)
  })

  it('counts what is waiting', async () => {
    const { manager, member, team } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    await submitStandup(member, { work: [{ project: String(project._id), hours: 6 }] })
    vi.useRealTimers()
    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })

    const res = await request(app)
      .get(`/api/timesheets?weekStart=${MONDAY}`).set(...authHeader(manager))

    expect(res.body.totals.awaiting).toBe(1)
    expect(res.body.totals.hours).toBe(6)
  })

  it('shows only the manager\'s own team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await request(app)
      .get(`/api/timesheets?weekStart=${MONDAY}`).set(...authHeader(manager))

    const names = res.body.people.map(p => String(p._id))
    expect(names).not.toContain(String(other.member._id))
  })

  it('refuses to show one person from another team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await request(app)
      .get(`/api/timesheets/${other.member._id}?weekStart=${MONDAY}`)
      .set(...authHeader(manager))

    expect(res.status).toBe(404)
  })

  it('does not read "me" as a user id', async () => {
    const { member } = await withTeam()

    // /me is declared before /:userId, so an employee still gets their own
    const res = await request(app).get('/api/timesheets/me').set(...authHeader(member))
    expect(res.status).toBe(200)
    expect(res.body.dates).toHaveLength(5)
  })
})

describe('Timesheet records', () => {
  it('keeps one row per person per week', async () => {
    const { member, team } = await withTeam()
    const project = await makeProject({ team: team._id })

    onTuesday()
    await submitStandup(member, { work: [{ project: String(project._id), hours: 4 }] })
    vi.useRealTimers()

    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })
    await request(app).post('/api/timesheets/submit')
      .set(...authHeader(member)).send({ weekStart: MONDAY })

    expect(await Timesheet.countDocuments({ user: member._id, weekStart: MONDAY })).toBe(1)
  })
})

describe('who a project belongs to', () => {
  it('gives a new project to the team the admin runs, not to everyone', async () => {
    // Defaulting to shared put a named client in front of every team
    const { team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })
    await Team.updateOne({ _id: team._id }, { manager: admin._id })

    const res = await request(app).post('/api/projects').set(...authHeader(admin))
      .send({ name: 'Zephyr Systems', client: 'Zephyr' })

    expect(res.status).toBe(201)
    expect(String(res.body.team)).toBe(String(team._id))
  })

  it('still makes a shared one when that is asked for', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app).post('/api/projects').set(...authHeader(admin))
      .send({ name: 'Leave', team: null, billable: false })

    expect(res.status).toBe(201)
    expect(res.body.team).toBeNull()
  })

  it('offers an admin the teams to choose from, and a manager none', async () => {
    const { manager, team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })

    const asAdmin = await request(app).get('/api/projects/all').set(...authHeader(admin))
    expect(asAdmin.body.canShare).toBe(true)
    expect(asAdmin.body.teams.map(t => String(t._id))).toContain(String(team._id))

    const asManager = await request(app).get('/api/projects/all').set(...authHeader(manager))
    expect(asManager.body.canShare).toBe(false)
    expect(asManager.body.teams).toEqual([])
    expect(String(asManager.body.defaultTeam)).toBe(String(team._id))
  })
})
