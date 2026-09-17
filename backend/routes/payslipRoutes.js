const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  myPayslips, getPayslip, payrollMonth, generatePayroll, publishPayroll
} = require('../controllers/payslipController')

router.use(protect)

// Running payroll is for whoever holds pay, which only an admin can
const payroll = [allowRoles('admin'), requireModule('pay')]
router.get('/run', ...payroll, validate(S.payrollMonth), payrollMonth)
router.post('/run', ...payroll, validate({ body: S.runPayroll }), generatePayroll)
router.post('/publish', ...payroll, validate({ body: S.runPayroll }), publishPayroll)

// One's own slips. Reading a single slip is checked in the controller:
// the owner once it is published, or payroll at any time.
router.get('/mine', requireModule('payslips'), myPayslips)
router.get('/:id', validate(S.roleId), getPayslip)

module.exports = router
