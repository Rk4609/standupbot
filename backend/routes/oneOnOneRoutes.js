const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const c = require('../controllers/oneOnOneController')

// Either side of a 1:1 — which side, and what it may change, is the controller's call
router.use(protect, requireModule('reviews'))

router.get('/', c.listOneOnOnes)
router.post('/', allowRoles('manager', 'admin'), requireModule('team-reviews'), validate({ body: S.scheduleOneOnOne }), c.scheduleOneOnOne)
router.get('/:id', validate(S.roleId), c.getOneOnOne)
router.patch('/:id', validate(S.updateOneOnOne), c.updateOneOnOne)
router.delete('/:id', validate(S.roleId), c.cancelOneOnOne)
router.post('/:id/items', validate(S.oneOnOneItem), c.addItem)
router.patch('/:id/items/:itemId', validate(S.toggleOneOnOneItem), c.toggleItem)
router.delete('/:id/items/:itemId', validate(S.oneOnOneItemId), c.removeItem)

module.exports = router
