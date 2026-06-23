const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['standup_submitted', 'blocker_added', 'reminder'],
    required: true
  },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  link: { type: String, default: '/team' }
}, { timestamps: true })

module.exports = mongoose.model('Notification', notificationSchema)