const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { aiLimiter } = require('../middleware/rateLimiters')
const S = require('../middleware/schemas')
const { analyzeTeam } = require('../controllers/aiController')

router.post(
  '/analyze-team',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('team'),
  aiLimiter,
  validate({ body: S.analyzeTeam }),
  analyzeTeam
)

module.exports = router
