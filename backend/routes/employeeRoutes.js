const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listEmployees,
  getSummary,
  getEmployee
} = require('../controllers/employeeController')

router.use(protect, allowRoles('manager', 'admin'), requireModule('employees'))

router.get('/', validate(S.listEmployees), listEmployees)
// Must come before /:id, or "summary" is read as an employee id
router.get('/summary', getSummary)
router.get('/:id', validate(S.idParam), getEmployee)

module.exports = router
