const express = require('express')
const router = express.Router()
const {
  register, login, forgotPassword, resetPassword, verifyResetToken
} = require('../controllers/authController')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  authLimiter, registerLimiter, passwordResetLimiter
} = require('../middleware/rateLimiters')

router.post('/register', registerLimiter, validate({ body: S.register }), register)
router.post('/login', authLimiter, validate({ body: S.login }), login)

//  Forgot password routes
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: S.forgotPassword }),
  forgotPassword
)
router.get('/verify-reset-token/:token', authLimiter, verifyResetToken)
router.put(
  '/reset-password/:token',
  passwordResetLimiter,
  validate(S.resetPassword),
  resetPassword
)

module.exports = router
