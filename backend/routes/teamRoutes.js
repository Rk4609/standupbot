const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { createTeam, addMember, getAllTeams } = require('../controllers/teamController')

router.use(protect, allowRoles('admin'), requireModule('people'))

router.post('/', validate({ body: S.createTeam }), createTeam)
router.post('/:id/members', validate(S.addMember), addMember)
router.get('/', getAllTeams)

module.exports = router
