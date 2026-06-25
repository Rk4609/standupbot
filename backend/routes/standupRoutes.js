const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const {
  submitStandup, getMyStandups,
  getTeamStandups, getBlockers, getTeamStats,updateBlocker,deleteBlocker
} = require('../controllers/standupController')

router.post('/', protect, submitStandup)
router.get('/my', protect, getMyStandups)
router.get('/team', protect, allowRoles('manager', 'admin'), getTeamStandups)
router.get('/blockers', protect, allowRoles('manager', 'admin'), getBlockers)
router.get('/stats', protect, allowRoles('manager', 'admin'), getTeamStats)
//  New — Edit & Delete blocker
router.put('/:id/blocker', protect, allowRoles('admin'), updateBlocker)
router.delete('/:id', protect, allowRoles('admin'), deleteBlocker)


module.exports = router