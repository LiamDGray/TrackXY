/**
 * Lomb–Scargle periodogram.
 *
 * The damped-sinusoid fit and the FFT both assume a complete, evenly sampled
 * record. Real torsion-balance runs are neither: the tracker drops frames when
 * the target is momentarily lost, the runs are short relative to the period, and
 * the amplitude decays. Lomb–Scargle works on unevenly sampled data without
 * interpolation, which is why it is the standard tool for sparse astronomical
 * time series — and the right default here when a record has gaps or is shorter
 * than a couple of periods.
 *
 * This implementation normalises by the data variance (the "standard"
 * periodogram), so a peak of height `P` can be read against the
 * false-alarm-probability estimate returned alongside it.
 */

/**
 * @param {number[]} t sample times (any units, typically seconds)
 * @param {number[]} x values
 * @param {object} [options]
 * @returns {{frequencies:number[], power:number[], peak:{frequency:number,power:number,fap:number}, resolutionHz:number}}
 */
export function lombScargle(t, x, options = {}) {
  const {
    minFrequency = null,
    maxFrequency = null,
    samplesPerPeak = 5,
    maxWork = 5e7,
    fapLevels = [0.1, 0.01, 0.001],
  } = options

  if (t.length !== x.length) throw new Error('time and value lengths differ')
  if (t.length < 8) throw new Error('need at least eight samples for a periodogram')

  const n = t.length
  const duration = t[n - 1] - t[0]
  if (!(duration > 0)) throw new Error('time base must be positive')

  const mean = x.reduce((a, b) => a + b, 0) / n
  const variance = x.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  if (!(variance > 0)) throw new Error('the series has no variance to analyse')

  const y = x.map((v) => v - mean)

  const fMin = minFrequency ?? 1 / duration
  const fMax = maxFrequency ?? 0.5 / medianDelta(t)
  if (!(fMax > fMin)) throw new Error('empty frequency range')

  // Direct evaluation is O(samples x frequencies). Cap the grid by a work budget
  // so a long record with a wide band cannot stall; the cap is reported.
  const desired = Math.max(64, Math.ceil((fMax - fMin) * duration * samplesPerPeak))
  const steps = Math.max(64, Math.min(desired, Math.floor(maxWork / n)))
  const frequencies = new Array(steps)
  const power = new Array(steps)

  for (let i = 0; i < steps; i += 1) {
    const f = fMin + ((fMax - fMin) * i) / (steps - 1)
    frequencies[i] = f
    power[i] = powerAt(f, t, y, variance)
  }

  // Peak, with a parabolic refinement in frequency.
  let best = 1
  for (let i = 2; i < steps - 1; i += 1) if (power[i] > power[best]) best = i
  const a = power[best - 1]
  const b = power[best]
  const c = power[best + 1]
  const denom = a - 2 * b + c
  const offset = Math.abs(denom) > 1e-15 ? (0.5 * (a - c)) / denom : 0
  const peakFrequency = frequencies[best] + offset * (frequencies[best + 1] - frequencies[best])

  // Approximate false-alarm probability: for the normalised periodogram the
  // single-frequency tail is exp(-P), and the number of independent frequencies
  // is roughly the number of cycles spanned.
  const independentFrequencies = Math.max(1, (fMax - fMin) * duration)
  const fap = 1 - (1 - Math.exp(-b)) ** independentFrequencies

  return {
    frequencies,
    power,
    peak: { frequency: peakFrequency, power: b, fap },
    resolutionHz: (fMax - fMin) / (steps - 1),
    fapLevels,
    independentFrequencies,
    samples: n,
    duration,
    gridCapped: steps < desired,
  }
}

function powerAt(f, t, y, variance) {
  const w = 2 * Math.PI * f
  let sumCos = 0
  let sumSin = 0
  let sumCos2 = 0
  let sumSin2 = 0
  let sumCosSin = 0

  // Time offset for numerical stability (Press & Rybicki).
  for (let i = 0; i < t.length; i += 1) {
    const angle = w * t[i]
    sumCos += Math.cos(angle)
    sumSin += Math.sin(angle)
    sumCos2 += Math.cos(2 * angle)
    sumSin2 += Math.sin(2 * angle)
  }
  const tau = Math.atan2(sumSin2, sumCos2) / (2 * w)

  let yc = 0
  let ys = 0
  let cc = 0
  let ss = 0
  let cs = 0
  for (let i = 0; i < t.length; i += 1) {
    const angle = w * (t[i] - tau)
    const co = Math.cos(angle)
    const si = Math.sin(angle)
    yc += y[i] * co
    ys += y[i] * si
    cc += co * co
    ss += si * si
    cs += co * si
  }

  const denominator = cc * ss - cs * cs
  if (Math.abs(denominator) < 1e-12) return 0
  const term = (yc * yc * ss - 2 * yc * ys * cs + ys * ys * cc) / denominator
  return term / (2 * variance)
}

function medianDelta(t) {
  const deltas = []
  for (let i = 1; i < t.length; i += 1) deltas.push(t[i] - t[i - 1])
  deltas.sort((a, b) => a - b)
  return deltas[Math.floor(deltas.length / 2)]
}
