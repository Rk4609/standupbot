const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { analyzeTeam } = require('../controllers/aiController')

router.post(
  '/analyze-team',
  protect,
  allowRoles('manager', 'admin'),
  analyzeTeam
)

module.exports = router