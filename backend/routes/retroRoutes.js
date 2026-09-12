const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const { aiLimiter } = require('../middleware/rateLimiters')
const S = require('../middleware/schemas')
const {
  generateRetro, listRetros, getCurrentRetro
} = require('../controllers/retroController')

router.use(protect, allowRoles('manager', 'admin'))

router.get('/', listRetros)
router.get('/current', getCurrentRetro)
router.post('/generate', aiLimiter, validate({ body: S.generateRetro }), generateRetro)

module.exports = router
