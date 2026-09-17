const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const { search } = require('../controllers/searchController')

// Open to everybody signed in: what each kind of result may show is decided
// per kind in the controller, by the same rules as the page it links to
router.get('/', protect, validate(S.searchQuery), search)

module.exports = router
