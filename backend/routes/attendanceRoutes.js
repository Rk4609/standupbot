const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  myAttendance, checkIn, checkOut, teamAttendance, correctAttendance
} = require('../controllers/attendanceController')

router.use(protect)

// Your own day
router.get('/me', requireModule('attendance'), validate(S.listAttendance), myAttendance)
router.post('/check-in', requireModule('attendance'), validate({ body: S.attendanceNote }), checkIn)
router.post('/check-out', requireModule('attendance'), validate({ body: S.attendanceNote }), checkOut)

// The team's. Whose day a manager may read or fix — their own teams, never
// themselves — is checked in the controller.
const lead = [allowRoles('manager', 'admin'), requireModule('team-attendance')]
router.get('/team', ...lead, validate(S.listAttendance), teamAttendance)
router.post('/correct', ...lead, validate({ body: S.correctAttendance }), correctAttendance)

module.exports = router
