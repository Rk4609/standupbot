const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  submitStandup, getMyStandups,
  getTeamStandups, getBlockers, getTeamStats, updateBlocker,
  updateStandup, getStandupHistory, deleteBlocker
} = require('../controllers/standupController')

router.post('/', protect, validate({ body: S.submitStandup }), submitStandup)
router.get('/my', protect, getMyStandups)
router.get(
  '/team',
  protect,
  allowRoles('manager', 'admin'),
  validate(S.dateQuery),
  getTeamStandups
)
router.get('/blockers', protect, allowRoles('manager', 'admin'), getBlockers)
router.get('/stats', protect, allowRoles('manager', 'admin'), getTeamStats)

// Edit your own standup, or your team's as a lead. The controller decides
// which, because "who may edit this" depends on the standup, not the route.
router.put('/:id', protect, validate(S.updateStandup), updateStandup)
router.get('/:id/history', protect, validate(S.idParam), getStandupHistory)

//  Edit & delete blocker
router.put(
  '/:id/blocker',
  protect,
  allowRoles('admin', 'manager'),
  validate(S.updateBlocker),
  updateBlocker
)
router.delete(
  '/:id',
  protect,
  allowRoles('admin', 'manager'),
  validate(S.idParam),
  deleteBlocker
)

module.exports = router
