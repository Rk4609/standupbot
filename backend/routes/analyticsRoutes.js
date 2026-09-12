const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { getOverview, exportStandups } = require('../controllers/analyticsController')

router.use(protect, allowRoles('manager', 'admin'))

router.get('/overview', validate(S.analyticsRange), getOverview)
router.get('/export', validate(S.analyticsRange), exportStandups)

module.exports = router
