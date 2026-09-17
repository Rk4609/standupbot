const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  listKudos, kudosPeople, giveKudos, cheerKudos, deleteKudos
} = require('../controllers/kudosController')

router.use(protect, requireModule('kudos'))

router.get('/', validate(S.listKudos), listKudos)
router.get('/people', validate(S.listKudos), kudosPeople)
router.post('/', validate({ body: S.giveKudos }), giveKudos)
router.post('/:id/cheer', validate(S.roleId), cheerKudos)
router.delete('/:id', validate(S.roleId), deleteKudos)

module.exports = router
