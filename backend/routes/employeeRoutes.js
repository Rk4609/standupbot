const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { listEmployees, getEmployee } = require('../controllers/employeeController')

router.use(protect, allowRoles('manager', 'admin'))

router.get('/', listEmployees)
router.get('/:id', getEmployee)

module.exports = router
