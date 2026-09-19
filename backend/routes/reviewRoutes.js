const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const c = require('../controllers/reviewController')

router.use(protect)

// Rounds, and the reviews a lead writes; whose they are is checked in the controller
const lead = [allowRoles('manager', 'admin'), requireModule('team-reviews')]
router.get('/cycles', ...lead, c.teamReviews)
router.post('/cycles', ...lead, validate({ body: S.startReviewCycle }), c.startCycle)
router.post('/cycles/:id/close', ...lead, validate(S.roleId), c.closeCycle)

const own = requireModule('reviews')
router.get('/mine', own, c.myReviews)
// Read by the owner or their reviewer — the controller tells them apart
router.get('/:id', validate(S.roleId), c.getReview)
router.put('/:id/self', own, validate(S.saveSelfReview), c.saveSelf)
router.post('/:id/acknowledge', own, validate(S.acknowledgeReview), c.acknowledgeReview)
router.put('/:id/manager', ...lead, validate(S.saveManagerReview), c.saveManager)
router.post('/:id/share', ...lead, validate(S.roleId), c.shareReview)

module.exports = router
