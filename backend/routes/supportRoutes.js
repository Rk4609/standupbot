const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  createTicket, myTickets, listTickets, replyToTicket, setStatus, applyRequest
} = require('../controllers/supportController')

// Anyone signed in can ask for help — that is the point of it
router.post('/', protect, validate({ body: S.createTicket }), createTicket)
router.get('/mine', protect, myTickets)

// Reading everything, and closing, are checked in the controller rather than
// by role here: the reply route is shared, because a reporter adds to their
// own thread through the same door
router.get('/', protect, validate(S.listTickets), listTickets)
router.post('/:id/reply', protect, validate(S.replyTicket), replyToTicket)
router.patch('/:id', protect, validate(S.ticketStatus), setStatus)

// Making the change somebody asked for is a people-records job, checked in
// the controller because the reply route beside it is shared with reporters
router.post('/:id/apply', protect, validate(S.roleId), applyRequest)

module.exports = router
