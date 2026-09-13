const { canUse } = require('../services/roleService')

//  specific roles for allow
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' })
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' })
  }
  next()
}

/**
 * The same gate one notch finer: not "is this a manager" but "does this
 * manager still have analytics".
 *
 * Always used together with allowRoles, never instead of it. A role's module
 * list can only take away from what its authority level already allowed —
 * ticking a box on an employee-based role must not become a way in.
 */
const requireModule = (key) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' })
  }

  try {
    if (await canUse(req.user, key)) return next()
    return res.status(403).json({
      message: 'Your role does not have access to this. Ask an admin.'
    })
  } catch (err) {
    console.error('Permission check failed:', err.message)
    // A permission system that fails open is not one. A lookup that breaks
    // refuses the request rather than waving it through.
    return res.status(403).json({ message: 'Could not check your access' })
  }
}

module.exports = { allowRoles, requireModule }
