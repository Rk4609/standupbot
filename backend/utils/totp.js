const crypto = require('crypto')

/**
 * Time-based one-time codes (RFC 6238), the six digits an authenticator app
 * shows. Small enough to keep here rather than add a dependency for.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

/** A new random secret, base32 as authenticator apps expect. */
const newSecret = (bytes = 20) => {
  const buf = crypto.randomBytes(bytes)
  let bits = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

const base32Bytes = (secret) => {
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(ch)
    if (v === -1) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

/** The code for a secret at a given moment. */
const codeAt = (secret, at = Date.now()) => {
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', base32Bytes(secret)).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const value = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** Does this code match now, allowing one step either side for a slow clock? */
const verifyCode = (secret, code, at = Date.now()) => {
  const clean = String(code || '').replace(/\s+/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  return [-1, 0, 1].some(step => {
    const expected = codeAt(secret, at + step * STEP_SECONDS * 1000)
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))
  })
}

/** The link an authenticator app reads from a QR code. */
const otpauthUrl = ({ secret, account, issuer = 'StandupBot' }) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`

/**
 * Secrets are stored encrypted, so a copy of the database alone cannot mint
 * codes. The key comes from TWO_FACTOR_KEY, or the JWT secret if unset.
 */
const key = () => crypto.createHash('sha256').update(process.env.TWO_FACTOR_KEY || process.env.JWT_SECRET || '').digest()

const seal = (text) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.')
}

const open = (sealed) => {
  const [iv, tag, data] = String(sealed).split('.').map(p => Buffer.from(p, 'base64'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/** One-use codes for a lost phone: shown once, stored only as hashes. */
const recoveryCodes = (count = 8) =>
  Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })

const hashRecovery = (code) =>
  crypto.createHash('sha256').update(String(code).trim().toLowerCase()).digest('hex')

module.exports = { newSecret, codeAt, verifyCode, otpauthUrl, seal, open, recoveryCodes, hashRecovery }
