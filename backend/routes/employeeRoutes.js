const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const {
  listEmployees,
  getSummary,
  getEmployee
} = require('../controllers/employeeController')

router.use(protect, allowRoles('manager', 'admin'))

router.get('/', listEmployees)
// Must come before /:id, or "summary" is read as an employee id
router.get('/summary', getSummary)
router.get('/:id', getEmployee)

module.exports = router
