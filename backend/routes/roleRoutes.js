const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listRoles, myAccess, createRole, updateRole, deleteRole, assignRole
} = require('../controllers/roleController')

// What the signed-in person may open. Everybody asks this about themselves,
// so it sits in front of the admin gate below.
router.get('/me', protect, myAccess)

// Handing out access is an admin's job, and holding the roles module is the
// finer half of the same question
router.use(protect, allowRoles('admin'), requireModule('roles'))

router.get('/', listRoles)
router.post('/', validate({ body: S.createRole }), createRole)
router.patch('/:id', validate(S.updateRole), updateRole)
router.delete('/:id', validate(S.roleId), deleteRole)
router.post('/:id/assign', validate(S.assignRole), assignRole)

module.exports = router
