import test from 'node:test'
import assert from 'node:assert/strict'

import { parseCsv, summariseRows } from '../src/csv.js'

const HEADER = 'samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status'

test('parseCsv reads tracking rows and keeps the start marker distinct', () => {
  const text = [
    HEADER,
    '0, 0, 0, 0, 0, 0, Start: 2026-11-12 10:00:00',
    '1, 33, 100.5, 200.25, 10.05, 20.02, tracking',
    '2, 66, 101.0, 201.0, 10.1, 20.1, tracking',
  ].join('\n')

  const rows = parseCsv(text)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].startMarker, true)
  assert.equal(rows[0].tracking, false)
  assert.equal(rows[1].tracking, true)
  assert.equal(rows[1].xPx, 100.5)
  assert.equal(rows[1].xCal, 10.05)
})

test('parseCsv rejects a missing column', () => {
  assert.throws(() => parseCsv('milliseconds, x_px\n0, 1'), /y_px/)
})

test('parseCsv skips rows with unparseable numbers', () => {
  const rows = parseCsv([HEADER, '1, abc, 1, 2, 0, 0, tracking', '2, 33, 4, 5, 0, 0, tracking'].join('\n'))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].milliseconds, 33)
})

test('summariseRows counts a gap once and records its length', () => {
  const rows = parseCsv(
    [
      HEADER,
      '1, 0, 1, 1, 0, 0, tracking',
      '2, 33, 1, 1, 0, 0, lost',
      '3, 66, 1, 1, 0, 0, lost',
      '4, 99, 1, 1, 0, 0, tracking',
      '5, 132, 1, 1, 0, 0, tracking',
    ].join('\n'),
  )
  const summary = summariseRows(rows)
  assert.equal(summary.tracking, 3)
  assert.equal(summary.gaps, 1)
  assert.equal(summary.longestGap, 2)
})

test('summariseRows reports a trailing gap', () => {
  const rows = parseCsv(
    [HEADER, '1, 0, 1, 1, 0, 0, tracking', '2, 33, 1, 1, 0, 0, lost'].join('\n'),
  )
  assert.equal(summariseRows(rows).gaps, 1)
})

test('empty calibrated cells are absent, not zero', () => {
  const rows = parseCsv(
    [HEADER, '1, 0, 100, 200, , , tracking', '2, 33, 101, 201, , , tracking'].join('\n'),
  )
  assert.equal(rows[0].xCal, null)
  assert.equal(rows[0].yCal, null)
  assert.equal(rows[0].xPx, 100)
})

test('a zero calibrated value is still a value', () => {
  const rows = parseCsv([HEADER, '1, 0, 100, 200, 0, 0, tracking'].join('\n'))
  assert.equal(rows[0].xCal, 0)
})
