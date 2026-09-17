const PushSubscription = require('../models/PushSubscription')
const { publicKey, pushToUser } = require('../services/pushService')

// GET /api/push — whether push is on here, the key to subscribe with, and
// how many devices this person has turned it on for
const pushStatus = async (req, res) => {
  try {
    const devices = await PushSubscription.find({ user: req.user._id })
      .select('device createdAt lastSentAt endpoint')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      enabled: Boolean(publicKey()),
      publicKey: publicKey(),
      devices: devices.map(d => ({
        _id: d._id,
        device: d.device,
        createdAt: d.createdAt,
        lastSentAt: d.lastSentAt,
        // Enough for the page to recognise "this browser" without the whole URL
        endpointEnd: d.endpoint.slice(-24)
      }))
    })
  } catch (err) {
    console.error('Push status error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/push/subscribe — this device, for this person
const subscribe = async (req, res) => {
  try {
    if (!publicKey()) {
      return res.status(503).json({ message: 'Phone notifications are not set up on this server yet' })
    }

    const { endpoint, keys, device } = req.body

    // The same browser signing in as somebody else takes the device with it:
    // the previous account must stop receiving this person's notifications
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { $set: { user: req.user._id, keys, device: device || '' } },
      { upsert: true }
    )

    res.status(201).json({ message: 'Notifications are on for this device' })
  } catch (err) {
    console.error('Push subscribe error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/push/unsubscribe — stop this device
const unsubscribe = async (req, res) => {
  try {
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user._id })
    res.json({ message: 'Notifications are off for this device' })
  } catch (err) {
    console.error('Push unsubscribe error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/push/test — a sample, to see it arrive
const sendTest = async (req, res) => {
  try {
    if (!publicKey()) {
      return res.status(503).json({ message: 'Phone notifications are not set up on this server yet' })
    }
    const { sent } = await pushToUser(req.user._id, {
      title: 'StandupBot',
      body: 'Notifications are working on this device.',
      url: '/profile',
      tag: 'test'
    })
    if (sent === 0) return res.status(404).json({ message: 'No device is turned on for notifications' })
    res.json({ message: `Sent to ${sent} ${sent === 1 ? 'device' : 'devices'}` })
  } catch (err) {
    console.error('Push test error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { pushStatus, subscribe, unsubscribe, sendTest }
