const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles, requireModule } = require('../middleware/roleMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { listPeople, getPerson, updatePerson } = require('../controllers/peopleController')

// Somebody's date of birth and home address is not team-overview data: the
// module is separate from everything else a lead can open, so it can be
// handed out — or taken back — on its own
router.use(protect, allowRoles('manager', 'admin'), requireModule('records'))

router.get('/', validate(S.listPeople), listPeople)
router.get('/:id', validate(S.roleId), getPerson)
router.patch('/:id', validate(S.updatePerson), updatePerson)

module.exports = router
