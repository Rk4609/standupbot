const mongoose = require('mongoose')
const Role = require('../models/Role')
const User = require('../models/User')
const audit = require('../services/auditService')
const { ensureBuiltIns, invalidate, modulesFor, roleFor } = require('../services/roleService')
const { MODULES, MODULE_KEYS, DEFAULTS, allowedFor, sanitise } = require('../utils/modules')

/** A key from a name: "Delivery lead" → "delivery-lead". */
const keyFrom = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// GET /api/roles — every role, with how many people hold it
const listRoles = async (req, res) => {
  try {
    await ensureBuiltIns()

    const roles = await Role.find().sort({ builtIn: -1, name: 1 }).lean()

    // One grouped count rather than a query per role
    const [byNamed, byBase] = await Promise.all([
      User.aggregate([
        { $match: { accessRole: { $ne: null } } },
        { $group: { _id: '$accessRole', n: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { accessRole: null } },
        { $group: { _id: '$role', n: { $sum: 1 } } }
      ])
    ])

    const named = new Map(byNamed.map(r => [String(r._id), r.n]))
    const plain = new Map(byBase.map(r => [r._id, r.n]))

    res.json({
      roles: roles.map(r => ({
        ...r,
        // A built-in role is also held by everybody who was never given a
        // named one, which is most people
        people: (named.get(String(r._id)) || 0) + (r.builtIn ? plain.get(r.key) || 0 : 0),
        allowed: allowedFor(r.base)
      })),
      modules: MODULES,
      defaults: DEFAULTS
    })
  } catch (err) {
    console.error('List roles error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/roles/me — what the signed-in person may open
const myAccess = async (req, res) => {
  try {
    const role = await roleFor(req.user)
    res.json({
      role: role ? { key: role.key, name: role.name, base: role.base } : null,
      modules: await modulesFor(req.user)
    })
  } catch (err) {
    console.error('My access error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/roles — name a new one
const createRole = async (req, res) => {
  try {
    const { name, description = '', base = 'employee', modules } = req.body

    const key = keyFrom(name)
    if (!key) return res.status(400).json({ message: 'Give the role a name' })

    if (await Role.findOne({ key })) {
      return res.status(409).json({ message: 'A role by that name already exists' })
    }

    const role = await Role.create({
      key,
      name: name.trim(),
      description,
      base,
      modules: sanitise(modules || DEFAULTS[base], base),
      // Created knowing every module there is: none of them is news to it
      offered: MODULE_KEYS,
      builtIn: false,
      createdBy: req.user._id
    })

    invalidate()
    await audit.record({
      action: 'role.created',
      actor: req.user,
      entityType: 'Role',
      entityId: role._id,
      note: `${role.name} · ${role.base} · ${role.modules.length} modules`
    })

    res.status(201).json(role)
  } catch (err) {
    console.error('Create role error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/roles/:id — rename it, or change what it reaches
const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ message: 'No such role' })

    const { name, description, modules, base } = req.body

    // The admin role is the way back in. Editing it to remove the roles
    // screen would leave nobody able to put it back.
    if (role.key === 'admin' && modules) {
      return res.status(400).json({
        message: 'The Admin role keeps every module — that is the way back in'
      })
    }

    // A built-in role's authority is what `user.role` means; changing it
    // would silently re-level every account that holds it
    if (base && base !== role.base) {
      if (role.builtIn) {
        return res.status(400).json({ message: 'A built-in role keeps its level' })
      }
      role.base = base
      role.modules = sanitise(role.modules, base)
    }

    const before = [...role.modules]

    if (name !== undefined) role.name = name.trim()
    if (description !== undefined) role.description = description
    if (modules !== undefined) role.modules = sanitise(modules, role.base)

    await role.save()
    invalidate()

    const added = role.modules.filter(m => !before.includes(m))
    const removed = before.filter(m => !role.modules.includes(m))

    if (added.length || removed.length) {
      await audit.record({
        action: 'role.updated',
        actor: req.user,
        entityType: 'Role',
        entityId: role._id,
        note: role.name,
        changes: [{
          field: 'modules',
          from: removed.length ? `removed ${removed.join(', ')}` : '',
          to: added.length ? `added ${added.join(', ')}` : ''
        }]
      })
    }

    res.json(role)
  } catch (err) {
    console.error('Update role error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// DELETE /api/roles/:id — only ones somebody added, and only when unused
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ message: 'No such role' })

    if (role.builtIn) {
      return res.status(400).json({ message: 'The three original roles stay' })
    }

    const held = await User.countDocuments({ accessRole: role._id })
    if (held > 0) {
      return res.status(400).json({
        message: `${held} ${held === 1 ? 'person holds' : 'people hold'} this role. Move them first.`
      })
    }

    await role.deleteOne()
    invalidate()

    await audit.record({
      action: 'role.deleted',
      actor: req.user,
      entityType: 'Role',
      entityId: role._id,
      note: role.name
    })

    res.json({ message: `${role.name} removed` })
  } catch (err) {
    console.error('Delete role error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/roles/:id/assign — give it to the people picked
const assignRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) return res.status(404).json({ message: 'No such role' })

    const ids = (req.body.users || []).filter(id => mongoose.isValidObjectId(id))
    if (ids.length === 0) return res.status(400).json({ message: 'Nobody was selected' })

    // Nobody demotes themselves by accident: losing your own admin rights
    // mid-click is not something anybody means to do
    if (ids.some(id => String(id) === String(req.user._id)) && role.base !== req.user.role) {
      return res.status(400).json({ message: 'You cannot change your own level' })
    }

    const people = await User.find({ _id: { $in: ids } }).select('name role accessRole').lean()

    await User.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          // Both, always: `role` is what the server enforces, `accessRole` is
          // the name and the module list layered on top of it
          role: role.base,
          accessRole: role.builtIn ? null : role._id
        }
      }
    )

    invalidate()

    await Promise.all(people.map(p => audit.record({
      action: 'user.role_changed',
      actor: req.user,
      subject: p,
      entityType: 'Role',
      entityId: role._id,
      changes: [{ field: 'role', from: p.role, to: role.name }]
    })))

    res.json({
      message: `${people.length} ${people.length === 1 ? 'person' : 'people'} moved to ${role.name}`,
      count: people.length
    })
  } catch (err) {
    console.error('Assign role error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { listRoles, myAccess, createRole, updateRole, deleteRole, assignRole }
