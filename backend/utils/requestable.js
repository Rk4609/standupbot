/**
 * The fields somebody may ask an admin to change about them.
 *
 * Deliberately not everything: a position or a salary is a decision, not a
 * correction, and a form that lets somebody request one with an Apply button
 * next to it invites the wrong click. These are the things people actually
 * get wrong on the way in — a misspelt name, an old phone, a flat they moved
 * out of two years ago.
 */
const REQUESTABLE = [
  { key: 'name', label: 'Full name', kind: 'text' },
  { key: 'phone', label: 'Phone number', kind: 'text' },
  { key: 'dob', label: 'Date of birth', kind: 'date' },
  { key: 'address.line1', label: 'Address', kind: 'text' },
  { key: 'address.city', label: 'City', kind: 'text' },
  { key: 'address.state', label: 'State', kind: 'text' },
  { key: 'address.pincode', label: 'Pincode', kind: 'text' },
  { key: 'address.country', label: 'Country', kind: 'text' }
]

const REQUESTABLE_KEYS = REQUESTABLE.map(f => f.key)

const labelOf = (key) => REQUESTABLE.find(f => f.key === key)?.label || key

/** Read a dotted path off a document. */
const readField = (doc, key) =>
  key.split('.').reduce((value, part) => (value == null ? value : value[part]), doc)

module.exports = { REQUESTABLE, REQUESTABLE_KEYS, labelOf, readField }
