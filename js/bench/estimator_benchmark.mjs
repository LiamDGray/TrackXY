/**
 * Monte Carlo comparison of the two estimators on realistic damped data.
 *
 * Zero-crossing is what the C++ implementation uses; the damped sinusoid fit is
 * the proposed replacement. Numbers from this script are quoted in
 * docs/design/next-iteration.md, so keep them reproducible: fixed seeds, fixed
 * sampling rate, no wall-clock dependence.
 */
import { zeroCrossingEstimate, fitDampedSinusoid, phaseDifference } from '../src/estimators.js'

const FS = 60
const SECONDS = 8
const F = 1.7
const AMP = 1
const DAMPING = 0.35
const OFFSET = 0.2
const TRIALS = 200

function makeRng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    const u1 = (s + 0.5) / 4294967296
    s = (s * 1664525 + 1013904223) % 4294967296
    const u2 = (s + 0.5) / 4294967296
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
}

function signal(phase, sigma, rand) {
  const n = Math.round(SECONDS * FS)
  const t = new Array(n)
  const x = new Array(n)
  for (let i = 0; i < n; i += 1) {
    const ti = i / FS
    t[i] = ti
    x[i] = AMP * Math.exp(-DAMPING * ti) * Math.cos(2 * Math.PI * F * ti + phase) + OFFSET + sigma * rand()
  }
  return { t, x }
}

function rms(v) {
  return Math.sqrt(v.reduce((a, b) => a + b * b, 0) / v.length)
}

function stats(errors) {
  const finite = errors.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b)
  if (finite.length === 0) return { rms: Infinity, count: 0, median: Infinity, p95: Infinity }
  const median = finite[Math.floor(finite.length / 2)]
  const p95 = finite[Math.floor(finite.length * 0.95)]
  return { rms: rms(errors.filter(Number.isFinite)), count: finite.length, median, p95 }
}

const rows = []
for (const snrDb of [40, 30, 20, 10]) {
  const rand = makeRng(20261112)
  // Noise level from the RMS of the clean, decaying signal.
  const clean = signal(0.3, 0, rand)
  const sigma = rms(clean.x) / 10 ** (snrDb / 20)

  let fitReliable = 0
  const zcFreq = []
  const fitFreq = []
  const zcPhase = []
  const fitPhase = []

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const a = signal(0.3, sigma, rand)
    const b = signal(0.3 + Math.PI / 2, sigma, rand)

    const zcA = zeroCrossingEstimate(a.t, a.x)
    const zcB = zeroCrossingEstimate(b.t, b.x)
    if (zcA.frequency > 0 && zcB.frequency > 0) {
      zcFreq.push(zcA.frequency - F)
      // Baseline phase from the first crossing displacement is not available, so
      // phase error is only measured for the fit below.
    }

    const fa = fitDampedSinusoid(a.t, a.x)
    const fb = fitDampedSinusoid(b.t, b.x)
    if (fa.reliable && fb.reliable) {
      fitFreq.push(fa.frequency - F)
      fitPhase.push(phaseDifference(fb, fa).degrees - 90)
    }
    fitReliable += fa.reliable && fb.reliable ? 1 : 0
  }

  rows.push({
    snrDb,
    sigma,
    zcFreqRms: stats(zcFreq).rms,
    zcValid: zcFreq.length,
    fitFreq: stats(fitFreq),
    fitPhase: stats(fitPhase),
    fitReliable,
  })
}

console.log('SNR | zc f RMSE mHz | fit f RMSE mHz | fit f med mHz | fit Δφ med deg | fit Δφ p95 deg | fit reliable')
for (const r of rows) {
  const zc = r.zcValid === TRIALS ? (r.zcFreqRms * 1000).toFixed(1) : `${(r.zcFreqRms * 1000).toFixed(1)}*`
  console.log(
    `${String(r.snrDb).padStart(3)} | ${zc.padStart(14)} | ${(r.fitFreq.rms * 1000).toFixed(2).padStart(14)} | ${(r.fitFreq.median * 1000).toFixed(2).padStart(13)} | ${r.fitPhase.median.toFixed(2).padStart(14)} | ${r.fitPhase.p95.toFixed(2).padStart(13)} | ${r.fitReliable}/${TRIALS}`,
  )
}
