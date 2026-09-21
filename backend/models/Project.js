const mongoose = require('mongoose')

/**
 * Something people book their day against.
 *
 * A standup on its own answers "what did you do"; a project answers "for
 * whom, and does it bill". That second question is what makes the daily
 * entry something the business needs rather than a note to the team.
 */
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },

  // Short handle for grids and exports, where the full name will not fit
  code: { type: String, trim: true, uppercase: true, maxlength: 12, default: '' },

  client: { type: String, trim: true, maxlength: 120, default: '' },

  // Null means every team can book to it — internal work, leave, training
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  // Non-billable work still has to be recorded, or the week never adds up
  billable: { type: Boolean, default: true },

  /**
   * Who works on this.
   *
   * An empty list means the whole team, which is what every project was
   * before anyone could be assigned to one — so turning this on does not
   * suddenly make existing work unbookable. Name even one person and the
   * project becomes theirs.
   */
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Archived rather than deleted: people and history still point at it
  active: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

// The two ways this is read: a team's pickable list, and the whole catalogue
projectSchema.index({ team: 1, active: 1 })
projectSchema.index({ name: 1 })

// "What may this person book to" is asked on every standup form
projectSchema.index({ members: 1, active: 1 })

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema)
