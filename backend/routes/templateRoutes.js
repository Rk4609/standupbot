const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  getActiveTemplate, getTemplate, saveTemplate, resetTemplate
} = require('../controllers/templateController')

// Everyone needs to know what they are being asked
router.get('/active', protect, getActiveTemplate)

// Only a lead decides the questions
router.use(protect, allowRoles('manager', 'admin'))

router.get('/', validate(S.templateTeam), getTemplate)
router.put('/', validate({ body: S.saveTemplate }), saveTemplate)
router.delete('/', validate(S.templateTeam), resetTemplate)

module.exports = router
