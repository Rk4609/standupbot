const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { pushStatus, subscribe, unsubscribe, sendTest } = require('../controllers/pushController')

// Everybody signed in can have their own notifications on their own devices
router.use(protect)

router.get('/', pushStatus)
router.post('/subscribe', validate({ body: S.pushSubscribe }), subscribe)
router.post('/unsubscribe', validate({ body: S.pushUnsubscribe }), unsubscribe)
router.post('/test', sendTest)

module.exports = router
