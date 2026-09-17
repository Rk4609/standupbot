const jwt = require('jsonwebtoken')
const QRCode = require('qrcode')
const User = require('../models/User')
const audit = require('../services/auditService')
const { canUse } = require('../services/roleService')
const {
  newSecret, verifyCode, otpauthUrl, seal, open, recoveryCodes, hashRecovery
} = require('../utils/totp')

const CHALLENGE_MINUTES = 5

/** Admins and anybody who can see pay should have it; everybody else may. */
const requiredFor = async (user) => user.role === 'admin' || await canUse(user, 'pay')

const withSecrets = (id) => User.findById(id).select('+twoFactor.secret +twoFactor.pendingSecret +twoFactor.recovery')

/** A short-lived ticket that says "password was right", and nothing more. */
const challengeFor = (user) =>
  jwt.sign({ id: String(user._id), purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: `${CHALLENGE_MINUTES}m` })

const readChallenge = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded.purpose === '2fa' ? decoded.id : null
  } catch {
    return null
  }
}

/**
 * Check a six-digit code, or use up one recovery code.
 * Returns 'code', 'recovery' or null.
 */
const checkSecondFactor = async (user, code) => {
  const input = String(code || '').trim()
  if (/^\d{3}\s?\d{3}$/.test(input)) {
    return verifyCode(open(user.twoFactor.secret), input) ? 'code' : null
  }
  const hash = hashRecovery(input)
  const index = (user.twoFactor.recovery || []).indexOf(hash)
  if (index === -1) return null
  user.twoFactor.recovery.splice(index, 1)
  await user.save()
  return 'recovery'
}

// GET /api/auth/2fa — is it on, and does this role need it
const status = async (req, res) => {
  try {
    const user = await withSecrets(req.user._id)
    res.json({
      enabled: Boolean(user.twoFactor?.enabled),
      required: await requiredFor(req.user),
      recoveryLeft: user.twoFactor?.recovery?.length || 0,
      enabledAt: user.twoFactor?.enabledAt || null
    })
  } catch (err) {
    console.error('2FA status error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/2fa/setup — a new secret to scan, not active until confirmed
const setup = async (req, res) => {
  try {
    const user = await withSecrets(req.user._id)
    if (user.twoFactor?.enabled) return res.status(409).json({ message: 'Two-step sign-in is already on' })

    const secret = newSecret()
    user.twoFactor = { ...(user.twoFactor?.toObject?.() || {}), pendingSecret: seal(secret) }
    await user.save()

    const url = otpauthUrl({ secret, account: user.email })
    res.json({ secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) })
  } catch (err) {
    console.error('2FA setup error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/2fa/enable — confirm with a code from the app
const enable = async (req, res) => {
  try {
    const user = await withSecrets(req.user._id)
    if (!user.twoFactor?.pendingSecret) return res.status(400).json({ message: 'Start the setup first' })

    const secret = open(user.twoFactor.pendingSecret)
    if (!verifyCode(secret, req.body.code)) {
      return res.status(400).json({ message: 'That code did not match — check the time on your phone and try the next one' })
    }

    const codes = recoveryCodes()
    user.twoFactor = {
      enabled: true,
      secret: user.twoFactor.pendingSecret,
      pendingSecret: null,
      recovery: codes.map(hashRecovery),
      enabledAt: new Date()
    }
    await user.save()

    await audit.record({ action: 'user.2fa_enabled', actor: req.user, subject: req.user, entityType: 'User', entityId: req.user._id })
    res.json({ message: 'Two-step sign-in is on', recoveryCodes: codes })
  } catch (err) {
    console.error('2FA enable error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/2fa/disable — password and a current code, both
const disable = async (req, res) => {
  try {
    const user = await withSecrets(req.user._id).select('+password')
    if (!user.twoFactor?.enabled) return res.status(400).json({ message: 'Two-step sign-in is not on' })
    if (!(await user.matchPassword(req.body.password || ''))) {
      return res.status(401).json({ message: 'That password is not right' })
    }
    if (!(await checkSecondFactor(user, req.body.code))) {
      return res.status(401).json({ message: 'That code is not right' })
    }

    user.twoFactor = { enabled: false, secret: null, pendingSecret: null, recovery: [], enabledAt: null }
    await user.save()

    await audit.record({ action: 'user.2fa_disabled', actor: req.user, subject: req.user, entityType: 'User', entityId: req.user._id })
    res.json({ message: 'Two-step sign-in is off' })
  } catch (err) {
    console.error('2FA disable error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { status, setup, enable, disable, challengeFor, readChallenge, checkSecondFactor, withSecrets, requiredFor }
