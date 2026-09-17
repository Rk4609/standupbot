const mongoose = require('mongoose')

/**
 * One browser or phone that asked to be told things while the app is closed.
 *
 * A person can have several — a laptop and a phone — and each is its own
 * subscription. The endpoint is the browser vendor's address for that device
 * and is what identifies it; when the vendor says it is gone, the row goes.
 */
const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
  keys: {
    p256dh: { type: String, required: true, maxlength: 200 },
    auth: { type: String, required: true, maxlength: 100 }
  },
  // So the profile can say "this phone" rather than a URL
  device: { type: String, default: '', maxlength: 120 },
  lastSentAt: { type: Date, default: null }
}, { timestamps: true })

pushSubscriptionSchema.index({ user: 1 })

module.exports = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema)
