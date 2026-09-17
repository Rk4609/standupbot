const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { aiLimiter } = require('../middleware/rateLimiters')
const S = require('../middleware/schemas')
const { getWeeklyReport, generateWeeklyReport } = require('../controllers/weeklyReportController')

router.use(protect, allowRoles('manager', 'admin'), requireModule('reports'))

router.get('/weekly', validate(S.readWeeklyReport), getWeeklyReport)
router.post('/weekly', aiLimiter, validate({ body: S.writeWeeklyReport }), generateWeeklyReport)

module.exports = router
