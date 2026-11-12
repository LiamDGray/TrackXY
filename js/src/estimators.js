/**
 * Oscillation estimators.
 *
 * Two implementations, deliberately:
 *
 * - `zeroCrossingEstimate` reproduces the C++ analyser so the two codebases can
 *   be compared on the same input. It is the baseline, not the recommendation.
 * - `fitDampedSinusoid` fits x(t) = A·e^(−γt)·cos(2πft + φ) + c by Levenberg–
 *   Marquardt. It returns damping and standard errors, needs fewer crossings
 *   than the baseline, and is unbiased by the envelope decay.
 *
 * See docs/design/next-iteration.md for why the baseline fails on damped data.
 */

const TWO_PI = 2 * Math.PI

export function zeroCrossingEstimate(t, x) {
  if (t.length !== x.length) throw new Error('time and value arrays must match')
  if (x.length < 4) return { frequency: 0, amplitude: 0, mean: 0, crossings: 0 }

  const mean = x.reduce((a, b) => a + b, 0) / x.length
  let min = x[0]
  let max = x[0]
  for (const v of x) {
    if (v < min) min = v
    if (v > max) max = v
  }

  const crossings = []
  for (let i = 1; i < x.length; i += 1) {
    const v1 = x[i - 1] - mean
    const v2 = x[i] - mean
    if (v1 * v2 < 0) {
      const frac = (0 - v1) / (v2 - v1)
      crossings.push(t[i - 1] + frac * (t[i] - t[i - 1]))
    }
  }

  let frequency = 0
  if (crossings.length >= 4) {
    const span = crossings[crossings.length - 1] - crossings[0]
    const avgHalfPeriod = span / (crossings.length - 1)
    frequency = 1 / (2 * avgHalfPeriod)
  }

  return { frequency, amplitude: (max - min) / 2, mean, crossings: crossings.length }
}

/** Coarse frequency for initialisation: crossings when available, else peak-to-trough. */
export function initialFrequency(t, x) {
  const zc = zeroCrossingEstimate(t, x)
  if (zc.frequency > 0) return zc.frequency

  let iMax = 0
  let iMin = 0
  for (let i = 1; i < x.length; i += 1) {
    if (x[i] > x[iMax]) iMax = i
    if (x[i] < x[iMin]) iMin = i
  }
  const halfPeriod = Math.abs(t[iMax] - t[iMin])
  if (halfPeriod > 0) return 1 / (2 * halfPeriod)
  return 1
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Model and analytic Jacobian for p = [A, γ, f, φ, c]. */
function evaluate(tau, p, needJacobian) {
  const [A, gamma, f, phi, c] = p
  const n = tau.length
  const model = new Array(n)
  const jac = needJacobian ? Array.from({ length: 5 }, () => new Array(n)) : null
  const omega = TWO_PI * f

  for (let i = 0; i < n; i += 1) {
    const decay = Math.exp(-gamma * tau[i])
    const theta = omega * tau[i] + phi
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    model[i] = A * decay * cos + c

    if (jac) {
      jac[0][i] = decay * cos
      jac[1][i] = -A * tau[i] * decay * cos
      jac[2][i] = -A * decay * sin * TWO_PI * tau[i]
      jac[3][i] = -A * decay * sin
      jac[4][i] = 1
    }
  }
  return { model, jac }
}

function sseOf(tau, x, p) {
  const { model } = evaluate(tau, p, false)
  let sse = 0
  for (let i = 0; i < x.length; i += 1) {
    const r = x[i] - model[i]
    sse += r * r
  }
  return sse
}

/** Gaussian elimination with partial pivoting. Solves A·x = b in place on copies. */
function solveLinear(A, b) {
  const n = b.length
  const m = A.map((row) => row.slice())
  const y = b.slice()

  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-14) throw new Error('singular normal equations')
    if (pivot !== col) {
      ;[m[pivot], m[col]] = [m[col], m[pivot]]
      ;[y[pivot], y[col]] = [y[col], y[pivot]]
    }
    for (let row = col + 1; row < n; row += 1) {
      const factor = m[row][col] / m[col][col]
      if (factor === 0) continue
      for (let k = col; k < n; k += 1) m[row][k] -= factor * m[col][k]
      y[row] -= factor * y[col]
    }
  }

  const sol = new Array(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = y[row]
    for (let k = row + 1; k < n; k += 1) sum -= m[row][k] * sol[k]
    sol[row] = sum / m[row][row]
  }
  return sol
}

function invertMatrix(A) {
  const n = A.length
  const out = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])

  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(out[row][col]) > Math.abs(out[pivot][col])) pivot = row
    }
    if (Math.abs(out[pivot][col]) < 1e-14) throw new Error('singular matrix')
    if (pivot !== col) [out[pivot], out[col]] = [out[col], out[pivot]]
    const lead = out[col][col]
    for (let k = 0; k < 2 * n; k += 1) out[col][k] /= lead
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = out[row][col]
      if (factor === 0) continue
      for (let k = 0; k < 2 * n; k += 1) out[row][k] -= factor * out[col][k]
    }
  }

  return out.map((row) => row.slice(n))
}

export function fitDampedSinusoid(t, x, options = {}) {
  const { maxIterations = 200, tolerance = 1e-12 } = options
  if (t.length !== x.length) throw new Error('time and value arrays must match')
  if (t.length < 12) throw new Error('need at least 12 samples for a five-parameter fit')

  const n = t.length
  const t0 = t[0]
  const tau = t.map((ti) => ti - t0)

  // Initialise: offset, phase via linear least squares at γ = 0, frequency from
  // crossings or peak-to-trough.
  const c0 = mean(x)
  const f0 = initialFrequency(t, x)
  const omega0 = TWO_PI * f0
  let Sxx = 0
  let Sxy = 0
  let Syy = 0
  let bx = 0
  let by = 0
  for (let i = 0; i < n; i += 1) {
    const co = Math.cos(omega0 * tau[i])
    const si = Math.sin(omega0 * tau[i])
    Sxx += co * co
    Sxy += co * si
    Syy += si * si
    bx += (x[i] - c0) * co
    by += (x[i] - c0) * si
  }
  const det = Sxx * Syy - Sxy * Sxy
  if (Math.abs(det) < 1e-12) throw new Error('degenerate initialisation')
  const a = (bx * Syy - by * Sxy) / det
  const b = (by * Sxx - bx * Sxy) / det
  const amplitude0 = Math.hypot(a, b)
  const phi0 = Math.atan2(-b, a)

  let p = [amplitude0, 0, f0, phi0, c0]
  let sse = sseOf(tau, x, p)
  let lambda = 1e-3
  let converged = false

  for (let iter = 0; iter < maxIterations; iter += 1) {
    const { model, jac } = evaluate(tau, p, true)

    const JtJ = Array.from({ length: 5 }, () => new Array(5).fill(0))
    const Jtr = new Array(5).fill(0)
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        let sum = 0
        for (let i = 0; i < n; i += 1) sum += jac[row][i] * jac[col][i]
        JtJ[row][col] = sum
      }
      let sum = 0
      for (let i = 0; i < n; i += 1) sum += jac[row][i] * (x[i] - model[i])
      Jtr[row] = sum
    }

    const damped = JtJ.map((row, i) => row.map((v, j) => (i === j ? v * (1 + lambda) : v)))
    let delta
    try {
      delta = solveLinear(damped, Jtr)
    } catch {
      lambda *= 10
      if (lambda > 1e12) break
      continue
    }

    const candidate = p.map((v, i) => v + delta[i])
    // Bound the search: an unbounded Levenberg step can walk the frequency to a
    // different local minimum (or to 1e5 Hz on a noisy window). Keep it within a
    // factor of the initial estimate and the damping physical.
    const f0Safe = f0 > 0 ? f0 : 1
    candidate[2] = Math.min(Math.max(candidate[2], f0Safe / 4), f0Safe * 4)
    candidate[1] = Math.min(Math.max(candidate[1], -5), 20)
    if (!Number.isFinite(candidate[0]) || !Number.isFinite(candidate[2])) {
      lambda *= 10
      continue
    }
    const candidateSse = sseOf(tau, x, candidate)

    if (candidateSse < sse) {
      const improvement = (sse - candidateSse) / (sse || 1)
      p = candidate
      sse = candidateSse
      lambda = Math.max(lambda / 3, 1e-12)
      if (improvement < tolerance) {
        converged = true
        break
      }
    } else {
      lambda *= 5
      if (lambda > 1e12) break
    }
  }

  // Covariance from the Jacobian at the solution.
  const { jac } = evaluate(tau, p, true)
  const JtJ = Array.from({ length: 5 }, () => new Array(5).fill(0))
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      let sum = 0
      for (let i = 0; i < n; i += 1) sum += jac[row][i] * jac[col][i]
      JtJ[row][col] = sum
    }
  }

  let standardErrors = { amplitude: 0, damping: 0, frequency: 0, phase: 0, offset: 0 }
  const dof = Math.max(n - 5, 1)
  const sigma2 = sse / dof
  try {
    const cov = invertMatrix(JtJ).map((row) => row.map((v) => v * sigma2))
    standardErrors = {
      amplitude: Math.sqrt(Math.max(cov[0][0], 0)),
      damping: Math.sqrt(Math.max(cov[1][1], 0)),
      frequency: Math.sqrt(Math.max(cov[2][2], 0)),
      phase: Math.sqrt(Math.max(cov[3][3], 0)),
      offset: Math.sqrt(Math.max(cov[4][4], 0)),
    }
  } catch {
    // Singular covariance: report point estimates without uncertainty.
  }

  const energy = x.reduce((acc, v) => acc + v * v, 0)
  const relativeResidual = sse / (energy || 1)
  const frequencyError = standardErrors.frequency / (Math.abs(p[2]) || 1)
  // Convergence is a diagnostic, not a gate: a fit to data that is only
  // approximately sinusoidal (sin of a sinusoid, for a chord) never reaches the
  // numerical floor, and that does not make the estimate wrong.
  const reliable =
    Number.isFinite(p[2]) && p[2] > 0 && relativeResidual < 0.5 && frequencyError < 0.1

  return {
    amplitude: Math.abs(p[0]),
    damping: p[1],
    frequency: p[2],
    phase: wrapPhase(p[3]),
    offset: p[4],
    sse,
    relativeResidual,
    samples: n,
    // A fit that lands on the numerical floor is converged even if the
    // Levenberg step could no longer improve it.
    converged: converged || relativeResidual < 1e-10,
    reliable,
    relativeFrequencyError: frequencyError,
    standardErrors,
  }
}

export function wrapPhase(phase) {
  let value = phase
  while (value > Math.PI) value -= TWO_PI
  while (value < -Math.PI) value += TWO_PI
  return value
}

/**
 * Phase of `b` relative to `a`, in degrees, wrapped to [-180, 180].
 * When both fits carry a standard error, the combined one is returned in
 * `standardError`.
 */
export function phaseDifference(b, a) {
  const delta = wrapPhase(b.phase - a.phase)
  const seA = a.standardErrors?.phase ?? 0
  const seB = b.standardErrors?.phase ?? 0
  return {
    degrees: (delta * 180) / Math.PI,
    standardError: (Math.hypot(seA, seB) * 180) / Math.PI,
  }
}
