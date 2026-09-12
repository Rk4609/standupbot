const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const {
  generateRetro,
  listRetros,
  getCurrentRetro
} = require('../controllers/retroController')

router.use(protect, allowRoles('manager', 'admin'))

router.get('/', listRetros)
router.get('/current', getCurrentRetro)
router.post('/generate', generateRetro)

module.exports = router
