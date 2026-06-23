const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  standupTime: { type: String, default: '09:00' } // reminder time
}, { timestamps: true })

module.exports = mongoose.model('Team', teamSchema)