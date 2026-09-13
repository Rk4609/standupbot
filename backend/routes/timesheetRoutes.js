const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  getMyWeek, submitWeek, getTeamWeek, getPersonWeek, reviewWeek
} = require('../controllers/timesheetController')

// Your own week is yours
router.get('/me', protect, validate(S.weekQuery), getMyWeek)
router.post('/submit', protect, validate({ body: S.submitWeek }), submitWeek)

// Reviewing is a lead's job. These come after /me so "me" is never read as an id.
router.get(
  '/',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('timesheets'),
  requireModule('timesheets'),
  validate(S.weekQuery),
  getTeamWeek
)
router.get(
  '/:userId',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('timesheets'),
  validate(S.personWeek),
  getPersonWeek
)
router.patch(
  '/:userId',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('timesheets'),
  validate(S.reviewWeek),
  reviewWeek
)

module.exports = router
