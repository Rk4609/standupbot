const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { listSessions, endSession, endOthers } = require('../controllers/sessionController')

// Only ever one's own sessions
router.use(protect)

router.get('/', listSessions)
router.post('/others', endOthers)
router.delete('/:id', validate(S.roleId), endSession)

module.exports = router
