const express = require('express')
const router = express.Router()
const {
  register, login, loginSecondStep, forgotPassword, resetPassword, verifyResetToken
} = require('../controllers/authController')
const twoFactor = require('../controllers/twoFactorController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  authLimiter, registerLimiter, passwordResetLimiter
} = require('../middleware/rateLimiters')

router.post('/register', registerLimiter, validate({ body: S.register }), register)
router.post('/login', authLimiter, validate({ body: S.login }), login)
router.post('/login/2fa', authLimiter, validate({ body: S.loginSecondStep }), loginSecondStep)

// Two-step sign-in for the signed-in person's own account
router.get('/2fa', protect, twoFactor.status)
router.post('/2fa/setup', protect, twoFactor.setup)
router.post('/2fa/enable', protect, authLimiter, validate({ body: S.twoFactorCode }), twoFactor.enable)
router.post('/2fa/disable', protect, authLimiter, validate({ body: S.twoFactorDisable }), twoFactor.disable)

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
