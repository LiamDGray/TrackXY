/**
 * Balance-mode analysis: the quantities a torsion-balance experiment reports.
 *
 * A single damped sinusoid is the *baseline* for this kind of apparatus, not the
 * result. The published protocol reports four things that a global fit cannot:
 *
 * - the **centre of oscillation** (COO) and how far it shifts from its natural
 *   position, in cm, degrees of rotation, and milligram-equivalent force;
 * - the **amplitude envelope** over time, including the largest peak-to-peak
 *   excursion;
 * - the **frequencies present** (see spectrum.js), because the claim under test
 *   is that new ones appear;
 * - the **relaxation constant** of the COO shift, which is fitted as an
 *   exponential approach rather than a step.
 *
 * The unit conversions come from the apparatus calibration, not from this code:
 * for the published rig, 1° of rotation is 0.3 cm of displacement and requires
 * the equivalent of 4.6 mg of force.
 */

export const TORSION_DEFAULTS = {
  cmPerDeg: 0.3,
  mgPerDeg: 4.6,
}

export function cmToDeg(cm, { cmPerDeg = TORSION_DEFAULTS.cmPerDeg } = {}) {
  return cm / cmPerDeg
}

export function degToMg(deg, { mgPerDeg = TORSION_DEFAULTS.mgPerDeg } = {}) {
  return deg * mgPerDeg
}

export function cmToMg(cm, options = {}) {
  return degToMg(cmToDeg(cm, options), options)
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Moving-median centre-of-oscillation track with a configurable step. */
export function medianTrack(t, x, { windowSeconds = 60, stepSeconds = 10 } = {}) {
  if (t.length !== x.length) throw new Error('time and value lengths differ')
  const out = []
  const half = windowSeconds / 2
  for (let centre = t[0] + half; centre <= t[t.length - 1]; centre += stepSeconds) {
    const values = []
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] >= centre - half && t[i] < centre + half) values.push(x[i])
    }
    if (values.length >= 10) out.push({ t: centre, value: median(values) })
  }
  if (out.length < 8) throw new Error('not enough data for a centre-of-oscillation track')
  return out
}

/**
 * Per-window summary: robust centre (median), amplitude, and peak-to-peak.
 *
 * Windows default to non-overlapping; pass a smaller `stepSeconds` for a denser
 * envelope. Windows with fewer than `minSamples` are dropped rather than
 * reported as low-amplitude measurements.
 */
export function segmentStats(t, x, { windowSeconds = 300, stepSeconds = null, minSamples = 20 } = {}) {
  if (t.length !== x.length) throw new Error('time and value lengths differ')
  if (t.length === 0) throw new Error('no samples')
  const step = stepSeconds ?? windowSeconds
  const tStart = t[0]
  const tEnd = t[t.length - 1]

  const out = []
  for (let start = tStart; start < tEnd; start += step) {
    const stop = start + windowSeconds
    let count = 0
    let min = Infinity
    let max = -Infinity
    const values = []
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] < start || t[i] >= stop) continue
      const v = x[i]
      values.push(v)
      if (v < min) min = v
      if (v > max) max = v
      count += 1
    }
    if (count < minSamples) continue
    const centre = median(values)
    out.push({
      tStart: start,
      tEnd: Math.min(stop, tEnd),
      tMid: start + (Math.min(stop, tEnd) - start) / 2,
      samples: count,
      coo: centre,
      amplitude: (max - min) / 2,
      peakToPeak: max - min,
      min,
      max,
    })
  }
  return out
}

/**
 * Fit an exponential approach to a drifting centre:
 *   y(t) = cInf + (c0 − cInf)·exp(−(t − t0)/τ)
 *
 * τ is found by bounded grid search with a linear solve for `c0`/`cInf` at each
 * candidate, which is stable even when the series is short relative to τ.
 */
export function relaxationFit(t, y, { t0 = t[0], minTau = 10, maxTau = 20000, steps = 400 } = {}) {
  if (t.length !== y.length || t.length < 8) throw new Error('need at least eight samples')

  // Points before the onset are not part of the approach; including them makes
  // the model extrapolate backwards and inflates tau.
  const keep = []
  for (let i = 0; i < t.length; i += 1) if (t[i] >= t0) keep.push(i)
  if (keep.length < 8) throw new Error('not enough samples after the onset')
  t = keep.map((i) => t[i])
  y = keep.map((i) => y[i])

  let best = null
  const logMin = Math.log(minTau)
  const logMax = Math.log(maxTau)
  for (let i = 0; i < steps; i += 1) {
    const tau = Math.exp(logMin + ((logMax - logMin) * i) / (steps - 1))
    const fit = linearGivenTau(t, y, t0, tau)
    if (fit && (!best || fit.sse < best.sse)) best = { ...fit, tau }
  }
  if (!best) throw new Error('degenerate relaxation fit')

  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const sst = y.reduce((a, b) => a + (b - mean) ** 2, 0)
  return {
    tau: best.tau,
    start: best.c0,
    asymptote: best.cInf,
    shift: best.cInf - best.c0,
    sse: best.sse,
    rSquared: sst > 0 ? 1 - best.sse / sst : 0,
  }
}

function linearGivenTau(t, y, t0, tau) {
  // y = cInf·(1 − u) + c0·u, with u = exp(−(t − t0)/τ): linear in (cInf, c0).
  let s11 = 0
  let s12 = 0
  let s22 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < t.length; i += 1) {
    const u = Math.exp(-(t[i] - t0) / tau)
    const a1 = 1 - u
    const a2 = u
    s11 += a1 * a1
    s12 += a1 * a2
    s22 += a2 * a2
    b1 += a1 * y[i]
    b2 += a2 * y[i]
  }
  const det = s11 * s22 - s12 * s12
  if (Math.abs(det) < 1e-12) return null
  const cInf = (b1 * s22 - b2 * s12) / det
  const c0 = (b2 * s11 - b1 * s12) / det

  let sse = 0
  for (let i = 0; i < t.length; i += 1) {
    const u = Math.exp(-(t[i] - t0) / tau)
    const predicted = cInf + (c0 - cInf) * u
    sse += (y[i] - predicted) ** 2
  }
  return { c0, cInf, sse }
}

/**
 * Full balance report: centre-of-oscillation shift, amplitude envelope, and the
 * relaxation constant of the shift.
 *
 * `times` in seconds, `values` in centimetres of displacement at the target.
 */
/**
 * Onset of a centre-of-oscillation shift, from the first window whose centre has
 * moved a given fraction of the total shift.
 *
 * The onset is *not* identifiable from the shape of the curve: an exponential
 * fitted from a later start still fits, with the same τ, because c0 is free.
 * Anything sharper than this threshold depends on an event log, not the data —
 * so the protocol should record when the condition changed.
 */
export function detectOnset(segments, { fraction = 0.1 } = {}) {
  const coos = segments.map((s) => s.coo)
  const low = Math.min(...coos)
  const high = Math.max(...coos)
  const threshold = low + fraction * (high - low)
  for (const segment of segments) {
    if (segment.coo > threshold) return segment.tMid
  }
  return segments[0].tMid
}

/**
 * Evaluate the fitted relaxation at arbitrary times.
 *
 * Before the onset the centre sits at its baseline, which is *not* the fitted
 * start value — `start` is the level at the onset, already partway into the
 * shift. Using it before the onset leaves a step, and a step dominates every
 * low bin of the spectrum.
 */
export function driftModel(relaxation, baseline = relaxation.start) {
  const { start, asymptote, tau, onset } = relaxation
  return (t) => {
    if (t <= onset) return baseline
    const u = Math.exp(-(t - onset) / tau)
    return asymptote + (start - asymptote) * u
  }
}

/**
 * Fit an exponential approach that starts *from a known baseline*, so the model
 * is continuous at the onset.
 *
 * A free `start` value lets the curve jump at the onset, and a step is a
 * broadband low-frequency event that swamps the spectrum. With the baseline
 * taken from the pre-onset data, only τ and the asymptote are free.
 */
export function relaxationFitFromBaseline(t, y, { t0, start, minTau = 10, maxTau = 20000, steps = 400 } = {}) {
  const keep = []
  for (let i = 0; i < t.length; i += 1) if (t[i] >= t0) keep.push(i)
  if (keep.length < 6) throw new Error('not enough samples after the onset')
  const tt = keep.map((i) => t[i])
  const yy = keep.map((i) => y[i])

  let best = null
  for (let i = 0; i < steps; i += 1) {
    const tau = Math.exp(Math.log(minTau) + ((Math.log(maxTau) - Math.log(minTau)) * i) / (steps - 1))
    let num = 0
    let den = 0
    for (let k = 0; k < tt.length; k += 1) {
      const u = Math.exp(-(tt[k] - t0) / tau)
      num += (1 - u) * (yy[k] - start * u)
      den += (1 - u) * (1 - u)
    }
    if (den < 1e-12) continue
    const asymptote = num / den
    let sse = 0
    for (let k = 0; k < tt.length; k += 1) {
      const u = Math.exp(-(tt[k] - t0) / tau)
      const predicted = asymptote + (start - asymptote) * u
      sse += (yy[k] - predicted) ** 2
    }
    if (!best || sse < best.sse) best = { tau, asymptote, sse }
  }
  if (!best) throw new Error('degenerate relaxation fit')

  const mean = yy.reduce((a, b) => a + b, 0) / yy.length
  const sst = yy.reduce((a, b) => a + (b - mean) ** 2, 0)
  return {
    tau: best.tau,
    start,
    asymptote: best.asymptote,
    shift: best.asymptote - start,
    sse: best.sse,
    rSquared: sst > 0 ? 1 - best.sse / sst : 0,
  }
}

/**
 * Fit onset, time constant and asymptote together, with the baseline fixed to
 * the pre-shift level.
 *
 * Estimating the onset from a threshold biases τ: if the fit starts 120 s after
 * the shift really began, the curve is already a quarter of the way up and the
 * time constant comes out much too small. Searching onset and τ jointly, and
 * scoring the whole series including the flat part before the shift, removes
 * that bias — the pre-onset samples are what pin the onset down.
 */
export function relaxationFitFull(t, y, { minTau = 20, maxTau = 20000, steps = 200, onsetSteps = 40 } = {}) {
  if (t.length !== y.length || t.length < 20) throw new Error('need at least twenty samples')

  const duration = t[t.length - 1] - t[0]
  const head = []
  for (let i = 0; i < Math.max(10, Math.floor(t.length * 0.15)); i += 1) head.push(y[i])
  const baseline = median(head)

  let best = null
  for (let oi = 0; oi < onsetSteps; oi += 1) {
    const onset = t[0] + (duration * 0.6 * oi) / (onsetSteps - 1)
    for (let i = 0; i < steps; i += 1) {
      const tau = Math.exp(Math.log(minTau) + ((Math.log(maxTau) - Math.log(minTau)) * i) / (steps - 1))
      let num = 0
      let den = 0
      for (let k = 0; k < t.length; k += 1) {
        const u = t[k] <= onset ? 0 : Math.exp(-(t[k] - onset) / tau)
        num += (1 - u) * (y[k] - baseline * u)
        den += (1 - u) * (1 - u)
      }
      if (den < 1e-12) continue
      const asymptote = num / den
      let sse = 0
      for (let k = 0; k < t.length; k += 1) {
        const u = t[k] <= onset ? 0 : Math.exp(-(t[k] - onset) / tau)
        const predicted = asymptote + (baseline - asymptote) * u
        sse += (y[k] - predicted) ** 2
      }
      if (!best || sse < best.sse) best = { onset, tau, asymptote, sse }
    }
  }
  if (!best) throw new Error('degenerate relaxation fit')

  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const sst = y.reduce((a, b) => a + (b - mean) ** 2, 0)
  return {
    onset: best.onset,
    tau: best.tau,
    start: baseline,
    asymptote: best.asymptote,
    shift: best.asymptote - baseline,
    sse: best.sse,
    rSquared: sst > 0 ? 1 - best.sse / sst : 0,
  }
}

/**
 * Log-linear relaxation fit on a centre-of-oscillation track.
 *
 * For an exponential approach, `−ln(1 − p)` is linear in time with slope τ, where
 * `p` is the fraction of the way from the baseline to the asymptote. Estimating
 * the asymptote from the tail and fitting that line is far more stable than a
 * blind search over onset and τ, which happily trades a late onset for a long
 * time constant.
 */
export function relaxationFitLogLinear(track, { minProgress = 0.05, maxProgress = 0.95 } = {}) {
  if (track.length < 12) throw new Error('need at least twelve track points')
  const values = track.map((p) => p.value)
  const headCount = Math.max(5, Math.floor(track.length * 0.2))
  const tailCount = Math.max(5, Math.floor(track.length * 0.2))
  const baseline = median(values.slice(0, headCount))
  const asymptote = median(values.slice(-tailCount))
  const span = asymptote - baseline
  if (Math.abs(span) < 1e-9) throw new Error('no shift to fit')

  const xs = []
  const ts = []
  for (const point of track) {
    const progress = (point.value - baseline) / span
    if (progress < minProgress || progress > maxProgress) continue
    xs.push(-Math.log(1 - progress))
    ts.push(point.t)
  }
  if (xs.length < 6) throw new Error('not enough points in the transition to fit a relaxation')

  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanT = ts.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (ts[i] - meanT)
    den += (xs[i] - meanX) ** 2
  }
  if (den < 1e-12) throw new Error('degenerate transition')
  const tau = num / den
  const onset = meanT - tau * meanX

  const predict = (t) => asymptote + (baseline - asymptote) * Math.exp(-Math.max(0, t - onset) / tau)
  let sse = 0
  let mean = 0
  for (const point of track) mean += point.value / track.length
  let sst = 0
  for (const point of track) {
    sse += (point.value - predict(point.t)) ** 2
    sst += (point.value - mean) ** 2
  }

  return {
    tau,
    onset,
    start: baseline,
    asymptote,
    shift: span,
    sse,
    rSquared: sst > 0 ? 1 - sse / sst : 0,
  }
}

export function analyzeBalance(times, values, { windowSeconds = 300, torsion = TORSION_DEFAULTS } = {}) {
  const segments = segmentStats(times, values, { windowSeconds })
  if (segments.length < 3) throw new Error('need at least three windows; use a shorter --window')

  const coos = segments.map((s) => s.coo)
  const cooShiftCm = Math.max(...coos) - Math.min(...coos)

  const onset = detectOnset(segments)
  const beforeOnset = []
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] < onset) beforeOnset.push(values[i])
  }
  const baseline = beforeOnset.length >= 10 ? median(beforeOnset) : coos[0]
  // Fit τ on a dense moving-median track, not on the display windows: fifteen
  // window medians are too few to identify a time constant.
  const track = medianTrack(times, values, { windowSeconds: windowSeconds * 0.6, stepSeconds: Math.max(5, windowSeconds / 12) })
  let relaxation
  try {
    relaxation = relaxationFitLogLinear(track)
  } catch {
    relaxation = relaxationFitFull(track.map((p) => p.t), track.map((p) => p.value))
  }

  // Remove the fitted drift before measuring amplitude and spectra: otherwise a
  // falling centre looks like a larger oscillation, and the drift dominates the
  // low bins of the periodogram.
  const drift = driftModel(relaxation, baseline)
  const residual = values.map((v, i) => v - drift(times[i]))
  const residualSegments = segmentStats(times, residual, { windowSeconds })
  const peakToPeakMax = Math.max(...residualSegments.map((s) => s.peakToPeak))

  return {
    segments,
    residualSegments,
    residual,
    windowSeconds,
    cooShiftCm,
    cooShiftDeg: cmToDeg(cooShiftCm, torsion),
    cooShiftMg: cmToMg(cooShiftCm, torsion),
    peakToPeakMaxCm: peakToPeakMax,
    amplitudeMaxCm: peakToPeakMax / 2,
    relaxation,
    baseline,
    torsion,
  }
}
