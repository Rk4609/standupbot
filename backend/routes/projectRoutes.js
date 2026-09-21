const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listProjects, listAllProjects, createProject, updateProject,
  updateMembers, transferMember, projectActivity
} = require('../controllers/projectController')

// Everyone may see the projects open to them
router.get('/', protect, listProjects)

// Maintaining the catalogue is a lead's job
router.get('/all', protect, allowRoles('manager', 'admin'), requireModule('projects'), listAllProjects)
router.post(
  '/',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('projects'),
  validate({ body: S.createProject }),
  createProject
)
// Before /:id, so "activity" is never read as a project id
router.get(
  '/activity',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('projects'),
  requireModule('projects'),
  projectActivity
)

router.patch(
  '/:id',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('projects'),
  validate(S.updateProject),
  updateProject
)
router.patch(
  '/:id/members',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('projects'),
  validate(S.projectMembers),
  updateMembers
)
router.post(
  '/:id/transfer',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('projects'),
  validate(S.transferMember),
  transferMember
)

module.exports = router
