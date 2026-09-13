const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  getIntegration, saveIntegration, updateEvents, sendTest, disconnect
} = require('../controllers/slackController')

// Wiring a channel is a lead's decision, and the webhook is a secret
router.use(protect, allowRoles('manager', 'admin'), requireModule('integrations'))

router.get('/', validate(S.slackTeam), getIntegration)
router.put('/', validate({ body: S.saveSlack }), saveIntegration)
router.patch('/', validate({ body: S.updateSlack }), updateEvents)
router.post('/test', validate({ body: S.slackTeamBody }), sendTest)
router.delete('/', validate(S.slackTeam), disconnect)

module.exports = router
