const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listProjects, listAllProjects, createProject, updateProject,
  updateMembers, transferMember, projectActivity
} = require('../controllers/projectController')

// Everyone needs the list they can book against
router.get('/', protect, listProjects)

// Maintaining the catalogue is a lead's job
router.get('/all', protect, allowRoles('manager', 'admin'), listAllProjects)
router.post(
  '/',
  protect,
  allowRoles('manager', 'admin'),
  validate({ body: S.createProject }),
  createProject
)
// Before /:id, so "activity" is never read as a project id
router.get('/activity', protect, allowRoles('manager', 'admin'), projectActivity)

router.patch(
  '/:id',
  protect,
  allowRoles('manager', 'admin'),
  validate(S.updateProject),
  updateProject
)
router.patch(
  '/:id/members',
  protect,
  allowRoles('manager', 'admin'),
  validate(S.projectMembers),
  updateMembers
)
router.post(
  '/:id/transfer',
  protect,
  allowRoles('manager', 'admin'),
  validate(S.transferMember),
  transferMember
)

module.exports = router
