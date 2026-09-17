const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  myLeave, requestLeave, cancelLeave, teamLeave, approveLeave, rejectLeave, calendar
} = require('../controllers/leaveController')

router.use(protect)

// Asking for your own time off
router.get('/mine', requireModule('leave'), validate(S.listLeave), myLeave)
router.post('/', requireModule('leave'), validate({ body: S.requestLeave }), requestLeave)
router.post('/:id/cancel', requireModule('leave'), validate(S.roleId), cancelLeave)

// Who is away — read by both sides, scoped in the controller
router.get('/calendar', validate(S.listLeave), calendar)

// Answering other people's. Which requests a manager may answer (their own
// teams, never their own) is checked in the controller.
router.get('/team', allowRoles('manager', 'admin'), requireModule('leaves'), validate(S.listLeave), teamLeave)
router.post('/:id/approve', allowRoles('manager', 'admin'), requireModule('leaves'), validate(S.decideLeave), approveLeave)
router.post('/:id/reject', allowRoles('manager', 'admin'), requireModule('leaves'), validate(S.decideLeave), rejectLeave)

module.exports = router
