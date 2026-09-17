const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const {
  exportEmployees, exportAttendance, exportLeave, exportPayroll
} = require('../controllers/exportController')

// Each download needs the same module as the page it comes from
router.use(protect)

const lead = allowRoles('manager', 'admin')
router.get('/employees', lead, requireModule('employees'), exportEmployees)
router.get('/attendance', lead, requireModule('team-attendance'), exportAttendance)
router.get('/leave', lead, requireModule('leaves'), exportLeave)
router.get('/payroll', allowRoles('admin'), requireModule('pay'), exportPayroll)

module.exports = router
