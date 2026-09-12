const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listProjects, listAllProjects, createProject, updateProject
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
router.patch(
  '/:id',
  protect,
  allowRoles('manager', 'admin'),
  validate(S.updateProject),
  updateProject
)

module.exports = router
