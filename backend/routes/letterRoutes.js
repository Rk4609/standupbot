const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const c = require('../controllers/letterController')

// Public: a bank or a next employer checking a letter is real
router.get('/verify/:code', c.verifyLetter)

router.use(protect)

const own = requireModule('documents')
router.get('/mine', own, c.myLetters)
router.post('/request', own, validate({ body: S.requestLetter }), c.requestLetter)
router.post('/:id/cancel', own, validate(S.roleId), c.cancelRequest)

// Salary certificates also need pay — checked in the controller
const hr = [allowRoles('admin'), requireModule('letters')]
router.get('/', ...hr, c.listLetters)
router.get('/people', ...hr, c.letterPeople)
router.post('/', ...hr, validate({ body: S.issueLetter }), c.issueLetter)
router.post('/:id/issue', ...hr, validate(S.issueRequestedLetter), c.issueRequested)
router.post('/:id/decline', ...hr, validate(S.declineLetter), c.declineLetter)

// The owner, or whoever may issue it
router.get('/:id', validate(S.roleId), c.getLetter)

module.exports = router
