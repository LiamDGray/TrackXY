import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { classify } from '../bench/inventory-runs.mjs'

const TOOL = fileURLToPath(new URL('../bench/inventory-runs.mjs', import.meta.url))
const BAND = [0.015, 0.06]

function series({ seconds = 600, rate = 10, amplitude = 50, noise = 0.5, jumpAt = null, stuck = 0 }) {
  const t = []
  const x = []
  const y = []
  for (let i = 0; i < seconds * rate; i += 1) {
    const ti = i / rate
    t.push(ti)
    let value = amplitude * Math.cos(2 * Math.PI * 0.03 * ti) + noise * Math.sin(i * 1.37)
    if (jumpAt !== null && i > jumpAt) value = -value
    if (stuck > 0 && i < stuck) {
      // A tracker that has locked onto a dead spot reports the same coordinate.
      x.push(7)
      y.push(7)
      continue
    }
    x.push(value)
    y.push(1)
  }
  return { t, x, y }
}

test('a clean oscillation over many cycles is a candidate', () => {
  const { verdict, stats } = classify(series({ seconds: 900 }), BAND)
  assert.match(verdict, /candidate/)
  assert.ok(stats.cycles >= 3)
})

test('a tracking test with jumps is rejected', () => {
  // Alternate the sign every few samples: the tracker is losing the target.
  const s = series({ seconds: 600 })
  for (let i = 0; i < s.x.length; i += 7) s.x[i] = -s.x[i]
  for (let i = 1; i < s.x.length; i += 7) s.x[i] = s.x[i - 1]
  const { verdict } = classify(s, BAND)
  assert.match(verdict, /unstable/)
})

test('stuck segments are detected', () => {
  const { verdict } = classify(series({ seconds: 600, stuck: 400 }), BAND)
  assert.match(verdict, /unstable/)
})

test('a short record is rejected on length', () => {
  const { verdict } = classify(series({ seconds: 21, rate: 22 }), BAND)
  assert.match(verdict, /too short/)
})

test('a moderate record with too few cycles is flagged', () => {
  const { verdict } = classify(series({ seconds: 70 }), BAND)
  assert.match(verdict, /short:/)
})

test('the CLI reports a table over a directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trackxy-inv-'))
  try {
    const rows = ['samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status']
    for (let i = 0; i < 9000; i += 1) {
      const t = i / 10
      rows.push(`${i + 1}, ${Math.round(t * 1000)}, ${(50 * Math.cos(2 * Math.PI * 0.03 * t)).toFixed(3)}, 0, , , tracking`)
    }
    writeFileSync(join(dir, 'run.csv'), rows.join('\n') + '\n')
    const result = spawnSync(process.execPath, [TOOL, dir], { encoding: 'utf8', timeout: 120_000, check: false })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /candidate measurement run/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
