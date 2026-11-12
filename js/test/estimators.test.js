import test from 'node:test'
import assert from 'node:assert/strict'

import {
  zeroCrossingEstimate,
  fitDampedSinusoid,
  phaseDifference,
} from '../src/estimators.js'

const FS = 60 // Hz

function synth({ f = 1.7, amplitude = 1, phase = 0.6, damping = 0, offset = 0.2, seconds = 8, noise = 0, seed = 1 } = {}) {
  const n = Math.round(seconds * FS)
  const t = []
  const x = []
  let s = seed
  const rand = () => {
    // deterministic LCG -> standard normal (Box-Muller)
    s = (s * 1664525 + 1013904223) % 4294967296
    const u1 = (s + 0.5) / 4294967296
    s = (s * 1664525 + 1013904223) % 4294967296
    const u2 = (s + 0.5) / 4294967296
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  for (let i = 0; i < n; i += 1) {
    const ti = i / FS
    t.push(ti)
    x.push(amplitude * Math.exp(-damping * ti) * Math.cos(2 * Math.PI * f * ti + phase) + offset + noise * rand())
  }
  return { t, x }
}

test('zero-crossing baseline recovers frequency on a clean sine', () => {
  const { t, x } = synth({ f: 1.7 })
  const est = zeroCrossingEstimate(t, x)
  assert.ok(Math.abs(est.frequency - 1.7) < 0.01, `got ${est.frequency}`)
  assert.ok(Math.abs(est.amplitude - 1) < 0.01, `got ${est.amplitude}`)
})

test('zero-crossing baseline is biased by noise and damping', () => {
  const { t, x } = synth({ f: 1.7, damping: 0.35, noise: 0.05 })
  const est = zeroCrossingEstimate(t, x)
  // The baseline has no damping term, so the mean-crossing rate is not f.
  assert.ok(Math.abs(est.frequency - 1.7) > 0.005, `expected bias, got ${est.frequency}`)
})

test('damped sinusoid fit recovers frequency, amplitude, phase, damping', () => {
  const { t, x } = synth({ f: 1.7, amplitude: 1, phase: 0.6, damping: 0.35, offset: 0.2 })
  const fit = fitDampedSinusoid(t, x)
  assert.equal(fit.converged, true)
  assert.ok(Math.abs(fit.frequency - 1.7) < 1e-4, `freq ${fit.frequency}`)
  assert.ok(Math.abs(fit.amplitude - 1) < 1e-3, `amp ${fit.amplitude}`)
  assert.ok(Math.abs(fit.damping - 0.35) < 1e-4, `damping ${fit.damping}`)
  assert.ok(Math.abs(fit.offset - 0.2) < 1e-4, `offset ${fit.offset}`)
  assert.ok(Math.abs(fit.phase - 0.6) < 1e-4, `phase ${fit.phase}`)
})

test('fit reports standard errors that grow with noise', () => {
  const cleanSeries = synth({ noise: 0 })
  const noisySeries = synth({ noise: 0.1 })
  const clean = fitDampedSinusoid(cleanSeries.t, cleanSeries.x)
  const noisy = fitDampedSinusoid(noisySeries.t, noisySeries.x)
  assert.ok(clean.standardErrors.frequency < 1e-5)
  assert.ok(noisy.standardErrors.frequency > 1e-4, `se ${noisy.standardErrors.frequency}`)
  assert.ok(noisy.standardErrors.frequency < 1, 'standard error must stay plausible')
})

test('fit survives a short window where zero-crossing cannot', () => {
  // 0.8 s at 1.7 Hz: too few mean crossings for the baseline estimator.
  const { t, x } = synth({ f: 1.7, seconds: 0.8 })
  assert.equal(zeroCrossingEstimate(t, x).frequency, 0)
  const fit = fitDampedSinusoid(t, x)
  assert.ok(Math.abs(fit.frequency - 1.7) < 0.05, `freq ${fit.frequency}`)
})

test('phaseDifference returns the wrapped difference in degrees', () => {
  const a = synth({ phase: 0.3, seconds: 6 })
  const b = synth({ phase: 0.3 + Math.PI / 2, seconds: 6 })
  const fa = fitDampedSinusoid(a.t, a.x)
  const fb = fitDampedSinusoid(b.t, b.x)
  const delta = phaseDifference(fb, fa)
  assert.ok(Math.abs(delta.degrees - 90) < 0.5, `delta ${delta.degrees}`)
})

test('phaseDifference wraps into [-180, 180]', () => {
  const a = { phase: 0 }
  const b = { phase: (3 * Math.PI) / 2 }
  const delta = phaseDifference(b, a)
  assert.ok(delta.degrees >= -180 && delta.degrees <= 180, `delta ${delta.degrees}`)
  assert.ok(Math.abs(delta.degrees + 90) < 1e-9, `delta ${delta.degrees}`)
})

test('fit rejects a signal with too few samples', () => {
  assert.throws(() => fitDampedSinusoid([0, 1], [0, 1]), /samples/i)
})
