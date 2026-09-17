/**
 * CSV the way Excel reads it: every field quoted (RFC 4180), a BOM so it is
 * taken as UTF-8, and CRLF line endings.
 */

const cell = (value) => {
  let text = value === null || value === undefined ? '' : String(value)
  // A field starting with = + - @ runs as a formula in Excel. Nothing a
  // person typed should be able to do that in somebody else's spreadsheet.
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

const toCsv = (header, rows) =>
  '﻿' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n')

const sendCsv = (res, filename, header, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(toCsv(header, rows))
}

module.exports = { cell, toCsv, sendCsv }
