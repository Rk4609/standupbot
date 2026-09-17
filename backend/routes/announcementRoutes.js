const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listAnnouncements, postAnnouncement, markRead, deleteAnnouncement
} = require('../controllers/announcementController')

// Everybody reads; who may post is checked in the controller
router.use(protect)

router.get('/', listAnnouncements)
router.post('/', validate({ body: S.postAnnouncement }), postAnnouncement)
router.post('/:id/read', validate(S.roleId), markRead)
router.delete('/:id', validate(S.roleId), deleteAnnouncement)

module.exports = router
