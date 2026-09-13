const Role = require('../models/Role')
const { ALWAYS, DEFAULTS, sanitise } = require('../utils/modules')

/**
 * Resolving a role costs a query, and every gated route asks. The answer
 * changes only when somebody edits a role, so it is held for a minute and
 * dropped the moment one is written.
 */
const TTL = 60_000
let cache = { at: 0, byId: new Map(), byKey: new Map() }

const invalidate = () => {
  cache = { at: 0, byId: new Map(), byKey: new Map() }
}

const load = async () => {
  if (Date.now() - cache.at < TTL && cache.byKey.size > 0) return cache

  const roles = await Role.find().lean()
  cache = {
    at: Date.now(),
    byId: new Map(roles.map(r => [String(r._id), r])),
    byKey: new Map(roles.map(r => [r.key, r]))
  }
  return cache
}

/** The three roles every account already had, created on first use. */
const ensureBuiltIns = async () => {
  const built = [
    {
      key: 'admin',
      name: 'Admin',
      description: 'Runs the workspace. Nothing is hidden from this role.',
      base: 'admin'
    },
    {
      key: 'manager',
      name: 'Manager',
      description: 'Reads their own team and sets up how the team works.',
      base: 'manager'
    },
    {
      key: 'employee',
      name: 'Employee',
      description: 'Reports their own day and reads their own history.',
      base: 'employee'
    }
  ]

  await Promise.all(built.map(r =>
    Role.updateOne(
      { key: r.key },
      { $setOnInsert: { ...r, modules: DEFAULTS[r.base], builtIn: true } },
      { upsert: true }
    )
  ))

  /**
   * Admin holds every module, including ones added after the workspace was
   * created. Without this an upgrade that introduces a module leaves it
   * reachable by nobody — not even the person whose job is handing it out —
   * and the roles screen refuses to edit the admin role for exactly the
   * reason that makes this safe: it is meant to hold everything.
   */
  await Role.updateOne({ key: 'admin' }, { $set: { modules: DEFAULTS.admin } })

  invalidate()
}

/**
 * The role a person actually has.
 *
 * `accessRole` wins when it is set — that is the named role somebody was
 * given. Otherwise the built-in one matching their authority level, and if
 * the collection has not been seeded yet, the defaults in code, so a fresh
 * database behaves exactly like the app did before roles existed.
 */
const roleFor = async (user) => {
  if (!user) return null
  const { byId, byKey } = await load()

  const named = user.accessRole ? byId.get(String(user.accessRole)) : null
  if (named) return named

  const builtIn = byKey.get(user.role)
  if (builtIn) return builtIn

  return {
    key: user.role,
    name: user.role,
    base: user.role,
    modules: DEFAULTS[user.role] || DEFAULTS.employee,
    builtIn: true
  }
}

/** Every module this person may open. */
const modulesFor = async (user) => {
  const role = await roleFor(user)
  if (!role) return []
  return sanitise(role.modules, role.base)
}

/** Does this person hold that module? */
const canUse = async (user, key) => {
  if (ALWAYS.includes(key)) return true
  return (await modulesFor(user)).includes(key)
}

module.exports = { ensureBuiltIns, invalidate, roleFor, modulesFor, canUse }
