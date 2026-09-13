import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import StandupTemplate from '../models/StandupTemplate.js'
import Standup from '../models/Standup.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const CORE = [
  { key: 'yesterday', label: 'Yesterday', type: 'long', required: true },
  { key: 'today', label: 'Today', type: 'long', required: true },
  { key: 'blockers', label: 'Blockers', type: 'long', required: false }
]

/** A manager with a team, which is what template editing needs. */
const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}` })
  const member = await joinTeam(await makeUser(), team)
  return { manager, team, member }
}

const save = (user, body) =>
  request(app).put('/api/templates').set(...authHeader(user)).send(body)

describe('the default template', () => {
  it('asks for the plan and the blockers, without writing a row for it', async () => {
    const person = await makeUser()

    const res = await request(app)
      .get('/api/templates/active').set(...authHeader(person))

    expect(res.status).toBe(200)
    // Not "what did you do yesterday" — that answer is usually yesterday's
    // plan, which is already on the page above
    expect(res.body.questions.map(q => q.key)).toEqual(['today', 'blockers'])
    expect(res.body.askMood).toBe(true)

    // Reading the form must not create anything
    expect(await StandupTemplate.countDocuments()).toBe(0)
  })

  it('tells a lead they are looking at the default, not their own', async () => {
    const { manager } = await withTeam()

    const res = await request(app)
      .get('/api/templates').set(...authHeader(manager))

    expect(res.body.custom).toBe(false)
  })
})

describe('saving a team template', () => {
  it('stores the team\'s own wording and extra questions', async () => {
    const { manager, member } = await withTeam()

    const res = await save(manager, {
      name: 'Morning check-in',
      questions: [
        ...CORE,
        { key: 'learned', label: 'What did you learn?', type: 'short', required: false }
      ]
    })

    expect(res.status).toBe(200)
    expect(res.body.custom).toBe(true)

    // And the team sees it when they open the form
    const active = await request(app)
      .get('/api/templates/active').set(...authHeader(member))

    expect(active.body.name).toBe('Morning check-in')
    expect(active.body.questions.map(q => q.key)).toContain('learned')
  })

  it('leaves another team on the default', async () => {
    const { manager } = await withTeam()
    await save(manager, { name: 'Ours', questions: CORE })

    const other = await withTeam()
    const res = await request(app)
      .get('/api/templates/active').set(...authHeader(other.member))

    expect(res.body.name).toBe('Daily standup')
  })

  it('lets a team drop the question about yesterday', async () => {
    const { manager, member } = await withTeam()

    const res = await save(manager, {
      questions: CORE.filter(q => q.key !== 'yesterday')
    })

    expect(res.status).toBe(200)

    const active = await request(app)
      .get('/api/templates/active').set(...authHeader(member))
    expect(active.body.questions.map(q => q.key)).toEqual(['today', 'blockers'])
  })

  it('refuses to remove a question the rest of the app reads', async () => {
    const { manager } = await withTeam()

    const res = await save(manager, {
      questions: CORE.filter(q => q.key !== 'blockers')
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/blockers/)
  })

  it('refuses to make the question about today optional', async () => {
    const { manager } = await withTeam()

    const res = await save(manager, {
      questions: CORE.map(q => (q.key === 'today' ? { ...q, required: false } : q))
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/what a standup is/i)
  })

  it('refuses two questions with the same key, which would overwrite answers', async () => {
    const { manager } = await withTeam()

    const res = await save(manager, {
      questions: [...CORE, { key: 'today', label: 'Again', type: 'long', required: true }]
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/share the key/i)
  })

  it('refuses a key that is not a safe identifier', async () => {
    const { manager } = await withTeam()

    const res = await save(manager, {
      questions: [...CORE, { key: 'What I Learned', label: 'x', type: 'long' }]
    })

    expect(res.status).toBe(400)
  })

  it('refuses a list too long to fill in every morning', async () => {
    const { manager } = await withTeam()

    const extras = Array.from({ length: 20 }, (_, i) => ({
      key: `q${i}`, label: `Question ${i}`, type: 'short'
    }))

    const res = await save(manager, { questions: [...CORE, ...extras] })
    expect(res.status).toBe(400)
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()
    const res = await save(employee, { questions: CORE })
    expect(res.status).toBe(403)
  })

  it('will not let a manager write another team\'s template', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await save(manager, { team: String(other.team._id), questions: CORE })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/another team/i)
  })
})

describe('resetting', () => {
  it('goes back to the default questions', async () => {
    const { manager, member } = await withTeam()
    await save(manager, { name: 'Ours', questions: CORE })

    const res = await request(app)
      .delete('/api/templates').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.custom).toBe(false)

    const active = await request(app)
      .get('/api/templates/active').set(...authHeader(member))
    expect(active.body.name).toBe('Daily standup')
  })
})

describe('submitting against a template', () => {
  const submit = (user, body) =>
    request(app).post('/api/standups').set(...authHeader(user)).send(body)

  it('stores answers to the team\'s own questions', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: [...CORE, { key: 'learned', label: 'Learned?', type: 'short' }]
    })

    const res = await submit(member, {
      yesterday: 'Shipped the export',
      today: 'Start on templates',
      answers: { learned: 'Mongoose Maps serialise as objects' }
    })

    expect(res.status).toBe(201)

    const saved = await Standup.findById(res.body._id).lean()
    expect(saved.answers.learned).toBe('Mongoose Maps serialise as objects')
  })

  it('enforces a question the team marked required', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: [
        ...CORE,
        { key: 'confidence', label: 'How confident are you?', type: 'short', required: true }
      ]
    })

    const res = await submit(member, { yesterday: 'a', today: 'b' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/How confident are you\?/)
  })

  it('accepts a missing answer the team made optional', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: [
        // This team does not ask what you did yesterday
        { key: 'yesterday', label: 'Yesterday', type: 'long', required: false },
        { key: 'today', label: 'Today', type: 'long', required: true },
        { key: 'blockers', label: 'Blockers', type: 'long', required: false }
      ]
    })

    const res = await submit(member, { today: 'Ship the templates' })

    expect(res.status).toBe(201)
    expect(res.body.yesterday).toBe('')
  })

  it('drops an answer to a question the team does not ask', async () => {
    const { manager, member } = await withTeam()
    await save(manager, { questions: CORE })

    const res = await submit(member, {
      yesterday: 'a',
      today: 'b',
      answers: { smuggled: 'not on the form' }
    })

    expect(res.status).toBe(201)
    const saved = await Standup.findById(res.body._id).lean()
    expect(saved.answers?.smuggled).toBeUndefined()
  })

  it('still detects a blocker, whatever the question is called', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: CORE.map(q =>
        q.key === 'blockers' ? { ...q, label: 'Anything in your way?' } : q
      )
    })

    const res = await submit(member, {
      yesterday: 'a',
      today: 'b',
      blockers: 'Waiting on the staging credentials'
    })

    expect(res.body.hasBlocker).toBe(true)
  })

  it('leaves a standup with no extra answers without an empty map', async () => {
    const person = await makeUser()

    const res = await request(app)
      .post('/api/standups').set(...authHeader(person))
      .send({ yesterday: 'a', today: 'b' })

    const saved = await Standup.findById(res.body._id).lean()
    expect(saved.answers).toEqual({})
  })
})

describe('custom answers downstream', () => {
  it('can be edited, and the trail names the question\'s key', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: [...CORE, { key: 'learned', label: 'Learned?', type: 'short' }]
    })

    const created = await request(app)
      .post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b', answers: { learned: 'First answer' } })

    const res = await request(app)
      .put(`/api/standups/${created.body._id}`).set(...authHeader(member))
      .send({ answers: { learned: 'Corrected answer' } })

    expect(res.status).toBe(200)

    const history = await request(app)
      .get(`/api/standups/${created.body._id}/history`).set(...authHeader(member))

    const change = history.body[0].changes.find(c => c.field === 'learned')
    expect(change).toEqual({ field: 'learned', from: 'First answer', to: 'Corrected answer' })
  })

  it('appears as its own column in the export', async () => {
    const { manager, member } = await withTeam()
    await save(manager, {
      questions: [...CORE, { key: 'learned', label: 'Learned?', type: 'short' }]
    })
    await request(app)
      .post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b', answers: { learned: 'Maps serialise as objects' } })

    const res = await request(app)
      .get('/api/analytics/export?days=7').set(...authHeader(manager))

    expect(res.text).toContain('"learned"')
    expect(res.text).toContain('Maps serialise as objects')
  })
})

describe('a template with nothing in it', () => {
  it('falls back to the questions rather than rendering an empty form', async () => {
    const { team, member } = await withTeam()

    // The API cannot save one of these, but a script can write one — and it
    // did, which left every member of two teams with a form to fill in that
    // had no questions on it
    await StandupTemplate.collection.insertOne({
      team: team._id,
      name: 'Broken',
      questions: [],
      askMood: true,
      trackTime: false
    })

    const res = await request(app)
      .get('/api/templates/active').set(...authHeader(member))

    expect(res.status).toBe(200)
    expect(res.body.questions.length).toBeGreaterThan(0)
    expect(res.body.questions.map(q => q.key)).toContain('today')
  })
})
