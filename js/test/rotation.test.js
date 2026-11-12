import test from 'node:test'
import assert from 'node:assert/strict'

import { analyze } from '../src/pipeline.js'
import { chordToAngle } from '../src/pipeline.js'
import { simulateRotation, observeCylinder, toCsv } from '../src/synthetic.js'

const RADIUS = 152.5

function run({ amplitudeDeg, seconds = 12, frequency = 0.8, noisePx = 0.05 } = {}) {
  const trajectory = simulateRotation({ amplitudeDeg, frequency, seconds, noisePx })
  const { rows, calibration } = observeCylinder(trajectory)
  const result = analyze({ csvText: toCsv(rows), calibration, radiusMm: RADIUS })
  return { result, calibration }
}

test('chordToAngle inverts the cylinder projection', () => {
  for (const theta of [0.1, 0.3, 0.6, 0.9]) {
    const chord = RADIUS * Math.sin(theta)
    assert.ok(Math.abs(chordToAngle(chord, RADIUS) - theta) < 1e-12)
  }
})

test('analyze recovers the rotational amplitude on a side view', () => {
  const { result } = run({ amplitudeDeg: 20 })
  assert.ok(Math.abs(result.rotation.amplitudeDeg - 20) < 1.0, `amp ${result.rotation.amplitudeDeg}`)
  assert.ok(Math.abs(result.rotation.frequencyHz - 0.8) < 0.01, `f ${result.rotation.frequencyHz}`)
  assert.equal(result.rotation.reliable, true)
})

test('the small-angle shortcut under-reads amplitude at large angles', () => {
  const { result } = run({ amplitudeDeg: 45 })
  const rot = result.rotation
  assert.ok(rot.naiveAmplitudeDeg < rot.amplitudeDeg - 3, `naive ${rot.naiveAmplitudeDeg} vs ${rot.amplitudeDeg}`)
  assert.ok(
    result.warnings.some((w) => /small-angle shortcut/.test(w)),
    `expected a warning, got ${result.warnings.join(' | ')}`,
  )
})

test('small oscillations make the shortcut indistinguishable', () => {
  const { result } = run({ amplitudeDeg: 8 })
  assert.ok(Math.abs(result.rotation.naiveAmplitudeDeg - result.rotation.amplitudeDeg) < 1.0)
  assert.ok(!result.warnings.some((w) => /small-angle shortcut/.test(w)))
})

test('a chord larger than the radius is flagged', () => {
  const trajectory = simulateRotation({ amplitudeDeg: 40 })
  const { rows } = observeCylinder(trajectory)
  const result = analyze({ csvText: toCsv(rows), radiusMm: 20 })
  assert.ok(result.warnings.some((w) => /exceeds the stated radius/.test(w)))
})
