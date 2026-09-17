const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { listCelebrations, sendWish } = require('../controllers/celebrationController')

// Part of everybody's dashboard: who sees whose days is decided in the controller
router.use(protect)

router.get('/', listCelebrations)
router.post('/wish', validate({ body: S.sendWish }), sendWish)

module.exports = router
