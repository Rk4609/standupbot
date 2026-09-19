const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { getSettings, updateSettings } = require('../controllers/settingsController')

router.use(protect)

// Everybody reads the office hours, allowances and holidays they work by
router.get('/', getSettings)
router.put('/', allowRoles('admin'), requireModule('settings'), validate({ body: S.updateSettings }), updateSettings)

module.exports = router
