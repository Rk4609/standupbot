const express = require('express')
const router = express.Router()
const { register, login,forgotPassword,resetPassword,verifyResetToken } = require('../controllers/authController')

router.post('/register', register)
router.post('/login', login)
//  Forgot password routes
router.post('/forgot-password', forgotPassword)
router.get('/verify-reset-token/:token', verifyResetToken)
router.put('/reset-password/:token', resetPassword)


module.exports = router