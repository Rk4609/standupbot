/**
 * Keep text headed for the model inside what it will accept.
 *
 * A prompt that lists a week of standups verbatim is fine for six people and
 * impossible for sixty: the request is refused before it is ever read. The
 * prompts cut each field down to size with `clip` rather than trusting the
 * data to stay small.
 */

const FIELD_LIMIT = 200

const clip = (text, limit = FIELD_LIMIT) => {
  const clean = String(text || '').trim().replace(/\s+/g, ' ')
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean
}

module.exports = { clip }
