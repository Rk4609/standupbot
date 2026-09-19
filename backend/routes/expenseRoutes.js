const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { receiptUpload } = require('../config/cloudinary')
const S = require('../middleware/schemas')
const c = require('../controllers/expenseController')

router.use(protect)

const mine = requireModule('expenses')
router.get('/mine', mine, c.myExpenses)
router.post('/receipt', mine, receiptUpload.single('receipt'), c.uploadReceipt)
router.post('/', mine, validate({ body: S.claimExpense }), c.claimExpense)
router.post('/:id/cancel', mine, validate(S.roleId), c.cancelExpense)

// Which claims a manager answers (their teams, never their own) is checked in the controller
const lead = [allowRoles('manager', 'admin'), requireModule('expense-approvals')]
router.get('/team', ...lead, c.teamExpenses)
router.post('/:id/approve', ...lead, validate(S.decideExpense), c.approveExpense)
router.post('/:id/reject', ...lead, validate(S.decideExpense), c.rejectExpense)

module.exports = router
