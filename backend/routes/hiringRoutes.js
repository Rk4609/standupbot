const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  submitCandidate, listCandidates, approveCandidate, rejectCandidate, withdrawCandidate
} = require('../controllers/hiringController')

// Putting somebody forward is a lead's job. Deciding is checked in the
// controller, because the same list is read by both sides — a manager sees
// what they submitted, an approver sees everything waiting.
router.use(protect, allowRoles('manager', 'admin'), requireModule('hiring'))

router.get('/', validate(S.listCandidates), listCandidates)
router.post('/', validate({ body: S.submitCandidate }), submitCandidate)
router.post('/:id/approve', validate(S.decideCandidate), approveCandidate)
router.post('/:id/reject', validate(S.decideCandidate), rejectCandidate)
router.delete('/:id', validate(S.roleId), withdrawCandidate)

module.exports = router
