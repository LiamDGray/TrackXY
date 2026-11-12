import test from 'node:test'
import assert from 'node:assert/strict'

import {
  centroid,
  principalAngle,
  wrapHalfTurn,
  unwrapAngles,
  angleFromPair,
  signedAngle,
  angularRate,
} from '../src/angle.js'

/** A line of points through the origin, rotated by `angle`. */
function linePoints(angle, radius = 20, count = 21) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const s = (i / (count - 1)) * 2 * radius - radius
    out.push([s * Math.cos(angle) + 100, s * Math.sin(angle) + 100])
  }
  return out
}

test('centroid is the mean position', () => {
  const c = centroid([[0, 0], [2, 0], [4, 0]])
  assert.deepEqual(c, [2, 0])
})

test('principalAngle is 0 for a horizontal marker and π/2 for a vertical one', () => {
  assert.ok(Math.abs(principalAngle(linePoints(0))) < 1e-9)
  assert.ok(Math.abs(principalAngle(linePoints(Math.PI / 2)) - Math.PI / 2) < 1e-9)
})

test('principalAngle follows rotation modulo π', () => {
  for (const rotation of [0.1, 0.4, 0.9, 1.3]) {
    const got = principalAngle(linePoints(rotation))
    const expected = wrapHalfTurn(rotation)
    assert.ok(Math.abs(got - expected) < 1e-9, `${rotation}: ${got} vs ${expected}`)
  }
})

test('unwrapAngles reconstructs a ramp across the π boundary', () => {
  const step = 0.25
  const truth = []
  for (let i = 0; i < 20; i += 1) truth.push(-1.0 + i * step)
  const wrapped = truth.map(wrapHalfTurn)
  const recovered = unwrapAngles(wrapped)
  for (let i = 0; i < truth.length; i += 1) {
    // Unwrapping is defined up to π: compare increments, which is what matters.
    if (i === 0) continue
    assert.ok(Math.abs(recovered[i] - recovered[i - 1] - step) < 1e-9, `step at ${i}`)
  }
})

test('angleFromPair gives the direction to a reference point', () => {
  assert.ok(Math.abs(angleFromPair([0, 0], [0, 1]) - Math.PI / 2) < 1e-12)
  assert.ok(Math.abs(angleFromPair([0, 0], [1, 0])) < 1e-12)
})

test('signedAngle resolves the half-turn ambiguity with a reference dot', () => {
  const marker = linePoints(0.4, 10, 11)
  const [cx, cy] = centroid(marker)
  // Reference dot on the +x side of the marker centre.
  const reference = [cx + 8, cy]
  const angle = signedAngle(marker, reference)
  assert.ok(Math.abs(angle - 0.4) < 1e-9, `angle ${angle}`)
})

test('angularRate recovers a constant rotation rate', () => {
  const omega = 2.4
  const times = []
  const angles = []
  for (let i = 0; i < 40; i += 1) {
    const t = i / 60
    times.push(t)
    angles.push(wrapHalfTurn(omega * t + 0.3))
  }
  const { rate } = angularRate(times, angles)
  assert.ok(Math.abs(rate - omega) < 1e-6, `rate ${rate}`)
})
