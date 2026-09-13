const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { listAudit } = require('../controllers/auditController')

router.get(
  '/',
  protect,
  allowRoles('manager', 'admin'),
  requireModule('activity'),
  validate(S.listAudit),
  listAudit
)

module.exports = router
