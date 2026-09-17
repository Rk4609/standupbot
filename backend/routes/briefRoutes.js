const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { aiLimiter } = require('../middleware/rateLimiters')
const S = require('../middleware/schemas')
const { getBrief, generateBrief } = require('../controllers/briefController')

router.use(protect, allowRoles('manager', 'admin'), requireModule('brief'))

// Reading costs nothing but queries; writing calls the model, so it is limited
router.get('/', validate(S.readBrief), getBrief)
router.post('/', aiLimiter, validate({ body: S.writeBrief }), generateBrief)

module.exports = router
