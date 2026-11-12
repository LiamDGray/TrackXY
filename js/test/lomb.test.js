import test from 'node:test'
import assert from 'node:assert/strict'

import { lombScargle } from '../src/lomb.js'

function sampled({ frequency = 0.029, seconds = 300, sampleRate = 31, noise = 0, gapFraction = 0, seed = 7 } = {}) {
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    const u1 = (s + 0.5) / 4294967296
    s = (s * 1664525 + 1013904223) >>> 0
    const u2 = (s + 0.5) / 4294967296
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  const t = []
  const x = []
  for (let i = 0; i < seconds * sampleRate; i += 1) {
    const ti = i / sampleRate
    if (gapFraction > 0 && rand() < gapFraction) continue
    t.push(ti)
    x.push(Math.cos(2 * Math.PI * frequency * ti) + noise * rand())
  }
  return { t, x }
}

test('recovers a clean frequency', () => {
  const { t, x } = sampled()
  const result = lombScargle(t, x, { minFrequency: 0.005, maxFrequency: 0.08 })
  assert.ok(Math.abs(result.peak.frequency - 0.029) < 0.001, `peak ${result.peak.frequency}`)
  assert.ok(result.peak.fap < 1e-6, `fap ${result.peak.fap}`)
})

test('recovers the frequency through 40% of samples missing', () => {
  const { t, x } = sampled({ gapFraction: 0.4 })
  const result = lombScargle(t, x, { minFrequency: 0.005, maxFrequency: 0.08 })
  assert.ok(Math.abs(result.peak.frequency - 0.029) < 0.001, `peak ${result.peak.frequency}`)
})

test('a short record at low signal-to-noise mis-estimates the period', () => {
  // Length is not the whole story: at high SNR a fraction of a period still
  // constrains frequency. What breaks a 21 s record is noise.
  const { t, x } = sampled({ seconds: 21, frequency: 0.029, noise: 2 })
  const result = lombScargle(t, x, { minFrequency: 0.005, maxFrequency: 0.5 })
  assert.ok(Math.abs(result.peak.frequency - 0.029) > 0.004, `peak ${result.peak.frequency} should be badly off`)
})

test('pure noise produces no significant peak', () => {
  let s = 99
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s + 0.5) / 4294967296
  }
  const t = []
  const x = []
  for (let i = 0; i < 3000; i += 1) {
    t.push(i / 31)
    x.push(rand() - 0.5)
  }
  const result = lombScargle(t, x, { minFrequency: 0.005, maxFrequency: 0.5 })
  assert.ok(result.peak.fap > 0.01, `fap ${result.peak.fap}`)
})

test('rejects degenerate input', () => {
  assert.throws(() => lombScargle([0, 1, 2], [1, 2, 3]), /eight samples/)
  assert.throws(() => lombScargle([0, 1, 2, 3, 4, 5, 6, 7], [1, 1, 1, 1, 1, 1, 1, 1]), /variance/)
})
