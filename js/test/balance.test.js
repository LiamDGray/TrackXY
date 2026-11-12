import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeBalance, segmentStats, relaxationFit, cmToDeg, cmToMg } from '../src/balance.js'
import { periodogram, bandPower } from '../src/spectrum.js'
import { simulateBalance } from '../src/synthetic.js'

test('unit conversions match the published apparatus calibration', () => {
  // From the torsion-constant calibration: 1 degree = 0.3 cm = 4.6 mg equivalent.
  assert.ok(Math.abs(cmToDeg(0.3) - 1) < 1e-12)
  assert.ok(Math.abs(cmToMg(0.3) - 4.6) < 1e-12)
  // The paper's largest reported shift: 2.2 cm = 7.3 degrees = 34 mg.
  assert.ok(Math.abs(cmToDeg(2.2) - 7.33) < 0.02, `deg ${cmToDeg(2.2)}`)
  assert.ok(Math.abs(cmToMg(2.2) - 33.7) < 0.2, `mg ${cmToMg(2.2)}`)
})

test('segmentStats tracks a drifting centre', () => {
  const t = []
  const x = []
  for (let i = 0; i < 600; i += 1) {
    const ti = i
    t.push(ti)
    x.push(ti < 300 ? 0 : 2) // step in the middle
  }
  const stats = segmentStats(t, x, { windowSeconds: 100 })
  assert.ok(stats.length >= 4)
  assert.ok(Math.abs(Math.min(...stats.map((s) => s.coo))) < 1e-9)
  assert.ok(Math.abs(Math.max(...stats.map((s) => s.coo)) - 2) < 1e-9)
})

test('relaxationFit recovers a known time constant', () => {
  const tau = 400
  const t = []
  const y = []
  for (let i = 0; i < 900; i += 1) {
    const ti = i * 2
    t.push(ti)
    y.push(2.2 * (1 - Math.exp(-(ti - 0) / tau)))
  }
  const fit = relaxationFit(t, y)
  assert.ok(Math.abs(fit.tau - tau) / tau < 0.1, `tau ${fit.tau}`)
  assert.ok(fit.rSquared > 0.999, `r2 ${fit.rSquared}`)
})

test('analyzeBalance finds the drift and the peak-to-peak amplitude', () => {
  const { t, x } = simulateBalance({ driftCm: 2.2, driftTau: 400, amplitudeCm: 0.5, seconds: 1800 })
  const result = analyzeBalance(t, x, { windowSeconds: 120 })
  assert.ok(result.cooShiftCm > 1.8, `coo shift ${result.cooShiftCm}`)
  assert.ok(result.cooShiftCm < 2.6, `coo shift ${result.cooShiftCm}`)
  assert.ok(result.amplitudeMaxCm > 0.45 && result.amplitudeMaxCm < 0.7, `amax ${result.amplitudeMaxCm}`)

  // Detrended spectrum must show the oscillation, not the drift.
  const spectrum = periodogram(t, result.residual, { minFrequency: 0.004 })
  assert.ok(Math.abs(spectrum.peaks[0].frequency - 0.034) < 0.004, `peak ${spectrum.peaks[0].frequency}`)
  assert.ok(Math.abs(result.relaxation.tau - 400) / 400 < 0.25, `tau ${result.relaxation.tau}`)
  assert.ok(Math.abs(result.relaxation.onset - 300) < 200, `onset ${result.relaxation.onset}`)
})

test('periodogram finds the ~30 s oscillation and a second tone', () => {
  const { t, x } = simulateBalance({
    frequency: 0.034,
    seconds: 1800,
    extraTones: [{ frequency: 0.011, amplitudeCm: 0.2 }],
    noiseCm: 0.01,
  })
  const spectrum = periodogram(t, x)
  const top = spectrum.peaks[0]
  assert.ok(Math.abs(top.frequency - 0.034) < 0.003, `peak ${top.frequency}`)
  const second = spectrum.peaks.find((p) => Math.abs(p.frequency - 0.011) < 0.003)
  assert.ok(second, `peaks: ${spectrum.peaks.map((p) => p.frequency.toFixed(4)).join(', ')}`)
})

test('bandPower concentrates in the low-frequency band for a slow signal', () => {
  const { t, x } = simulateBalance({ frequency: 0.034, seconds: 1200 })
  const spectrum = periodogram(t, x)
  assert.ok(bandPower(spectrum, 0.02, 0.05) > 0.5)
})
