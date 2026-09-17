const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  myOnboarding, listOnboarding, getOnboarding, createOnboarding, updateTask, addTask, removeTask
} = require('../controllers/onboardingController')

router.use(protect)

// A joiner reads and ticks their own checklist without any module: it is
// theirs, and a new account should not wait on a role being set up
router.get('/mine', myOnboarding)

// Everybody being onboarded, and starting one by hand, is a lead's view
const lead = [allowRoles('manager', 'admin'), requireModule('onboarding')]
router.get('/', ...lead, validate(S.listOnboarding), listOnboarding)
router.post('/', ...lead, validate({ body: S.startOnboarding }), createOnboarding)

// One checklist. Who may see, tick or change it is decided per checklist in
// the controller: the joiner, their manager, or an admin.
router.get('/:id', validate(S.roleId), getOnboarding)
router.patch('/:id/tasks/:taskId', validate(S.updateOnboardingTask), updateTask)
router.post('/:id/tasks', validate(S.addOnboardingTask), addTask)
router.delete('/:id/tasks/:taskId', validate(S.onboardingTask), removeTask)

module.exports = router
