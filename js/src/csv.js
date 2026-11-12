/**
 * CSV ingestion for TrackXY output.
 *
 * The on-disk schema is `samplenumber, milliseconds, x_px, y_px, x_cal, y_cal,
 * status`. Rows whose status is not `tracking` are retained but flagged, so the
 * caller can decide whether a gap is tolerable rather than silently treating a
 * pause as data.
 */

export const REQUIRED_COLUMNS = ['milliseconds', 'x_px', 'y_px', 'status']

export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim() !== '')
  if (lines.length < 2) throw new Error('csv has no data rows')

  const header = splitRow(lines[0]).map((name) => name.trim().toLowerCase())
  for (const column of REQUIRED_COLUMNS) {
    if (!header.includes(column)) throw new Error(`csv is missing the "${column}" column`)
  }

  const index = Object.fromEntries(header.map((name, i) => [name, i]))
  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitRow(lines[i])
    const status = (cells[index.status] ?? '').trim()
    const milliseconds = Number(cells[index.milliseconds])
    const xPx = Number(cells[index.x_px])
    const yPx = Number(cells[index.y_px])
    if (!Number.isFinite(milliseconds) || !Number.isFinite(xPx) || !Number.isFinite(yPx)) continue

    rows.push({
      row: i,
      milliseconds,
      xPx,
      yPx,
      xCal: index.x_cal === undefined ? null : maybeNumber(cells[index.x_cal]),
      yCal: index.y_cal === undefined ? null : maybeNumber(cells[index.y_cal]),
      status,
      tracking: status === 'tracking',
      startMarker: status.startsWith('Start:'),
    })
  }

  if (rows.length === 0) throw new Error('csv has no numeric data rows')
  return rows
}

function splitRow(line) {
  // The schema has no quoted fields; a plain split is correct and predictable.
  return line.split(',')
}

function maybeNumber(cell) {
  // Number('') is 0, which would turn an empty calibrated column into a
  // measurement of zero. Empty means absent, not zero.
  if (cell === undefined || cell.trim() === '') return null
  const value = Number(cell)
  return Number.isFinite(value) ? value : null
}

/** Count gaps: consecutive non-tracking rows, and total tracking rows. */
export function summariseRows(rows) {
  let tracking = 0
  let gaps = 0
  let longestGap = 0
  let currentGap = 0
  for (const row of rows) {
    if (row.tracking) {
      tracking += 1
      if (currentGap > 0) {
        gaps += 1
        longestGap = Math.max(longestGap, currentGap)
        currentGap = 0
      }
    } else if (!row.startMarker) {
      currentGap += 1
    }
  }
  if (currentGap > 0) {
    gaps += 1
    longestGap = Math.max(longestGap, currentGap)
  }
  return { tracking, gaps, longestGap }
}
