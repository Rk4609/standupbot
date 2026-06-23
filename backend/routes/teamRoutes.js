const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { createTeam, addMember, getAllTeams } = require('../controllers/teamController')

router.post('/', protect, allowRoles('admin'), createTeam)
router.post('/:id/members', protect, allowRoles('admin'), addMember)
router.get('/', protect, allowRoles('admin'), getAllTeams)

module.exports = router