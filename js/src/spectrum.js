/**
 * Spectral analysis for balance recordings.
 *
 * The published torsion-balance protocol does not just fit one sinusoid; it
 * asks which frequencies are present, because the claim under test is that new
 * frequencies appear when a subject is present. A single damped-sinusoid fit
 * cannot answer that, so this module provides a windowed periodogram and peak
 * picking.
 *
 * Sampling in that protocol is 10 Hz and periods are ~30 s, so recordings are
 * tens of thousands of samples: N is resampled, windowed and zero-padded to the
 * next power of two, and transformed with an iterative radix-2 FFT.
 */

/** In-place iterative radix-2 FFT. `re` and `im` must have power-of-two length. */
export function fft(re, im) {
  const n = re.length
  if (n !== im.length || (n & (n - 1)) !== 0) throw new Error('fft needs power-of-two arrays')

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k += 1) {
        const uRe = re[i + k]
        const uIm = im[i + k]
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe
        im[i + k + len / 2] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
  return { re, im }
}

/** Resample (t, x) onto a uniform grid using the median sample interval. */
export function uniformise(t, x) {
  if (t.length !== x.length) throw new Error('time and value lengths differ')
  if (t.length < 4) throw new Error('need at least four samples')
  const deltas = []
  for (let i = 1; i < t.length; i += 1) deltas.push(t[i] - t[i - 1])
  deltas.sort((a, b) => a - b)
  const dt = deltas[Math.floor(deltas.length / 2)]
  if (!(dt > 0)) throw new Error('sample interval must be positive')

  const n = Math.floor((t[t.length - 1] - t[0]) / dt) + 1
  const out = new Array(n)
  let j = 0
  for (let i = 0; i < n; i += 1) {
    const ti = t[0] + i * dt
    while (j < t.length - 2 && t[j + 1] < ti) j += 1
    const span = t[j + 1] - t[j]
    const w = span > 0 ? (ti - t[j]) / span : 0
    out[i] = x[j] * (1 - w) + x[j + 1] * w
  }
  return { samples: out, dt, sampleRate: 1 / dt }
}

function polyFit(x, y, order) {
  const size = order + 1
  const A = Array.from({ length: size }, () => new Array(size).fill(0))
  const b = new Array(size).fill(0)
  for (let i = 0; i < x.length; i += 1) {
    const powers = new Array(2 * order + 1).fill(1)
    for (let k = 1; k < powers.length; k += 1) powers[k] = powers[k - 1] * x[i]
    for (let r = 0; r < size; r += 1) {
      b[r] += powers[r] * y[i]
      for (let c = 0; c < size; c += 1) A[r][c] += powers[r + c]
    }
  }
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < size; col += 1) {
    let pivot = col
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return new Array(size).fill(0)
    ;[A[pivot], A[col]] = [A[col], A[pivot]]
    ;[b[pivot], b[col]] = [b[col], b[pivot]]
    for (let row = col + 1; row < size; row += 1) {
      const factor = A[row][col] / A[col][col]
      for (let k = col; k < size; k += 1) A[row][k] -= factor * A[col][k]
      b[row] -= factor * b[col]
    }
  }
  const out = new Array(size).fill(0)
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = b[row]
    for (let k = row + 1; k < size; k += 1) sum -= A[row][k] * out[k]
    out[row] = sum / A[row][row]
  }
  return out
}

function polyEval(coeffs, x) {
  let value = 0
  for (let i = coeffs.length - 1; i >= 0; i -= 1) value = value * x + coeffs[i]
  return value
}

function hann(n) {
  const w = new Array(n)
  for (let i = 0; i < n; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

function nextPowerOfTwo(n) {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Periodogram of (t, x), Hann-windowed and zero-padded.
 *
 * Returns frequencies in Hz and normalised power (peak = 1), plus the strongest
 * spectral peaks with sub-bin frequency interpolation.
 */
export function periodogram(t, x, { maxPeaks = 8, minPeakFraction = 0.05, detrend = 'linear', minFrequency = 0 } = {}) {
  const { samples, sampleRate } = uniformise(t, x)
  const n = samples.length
  if (n < 64) throw new Error('need at least 64 uniform samples for a spectrum')

  // A residual DC offset or a slow drift puts enormous power in the lowest bins
  // and hides everything else. A polynomial of low order removes the drift
  // without touching frequencies near the oscillation: `detrend: 3` is enough
  // for an exponential relaxation over tens of minutes.
  if (detrend !== false) {
    const order = detrend === 'linear' || detrend === true ? 1 : Number(detrend)
    const coeffs = polyFit(
      Array.from({ length: n }, (_, i) => i),
      samples,
      order,
    )
    for (let i = 0; i < n; i += 1) samples[i] -= polyEval(coeffs, i)
  }

  const mean = samples.reduce((a, b) => a + b, 0) / n
  const window = hann(n)
  const size = nextPowerOfTwo(n)
  const re = new Array(size).fill(0)
  const im = new Array(size).fill(0)
  for (let i = 0; i < n; i += 1) re[i] = (samples[i] - mean) * window[i]

  fft(re, im)

  const half = size / 2
  const power = new Array(half)
  const frequencies = new Array(half)
  for (let k = 0; k < half; k += 1) frequencies[k] = (k * sampleRate) / size

  // Normalise within the reported band. A slow drift carries more energy at
  // 0 Hz than any oscillation carries at its own peak, so normalising over the
  // whole spectrum makes every real peak look negligible.
  let max = 0
  for (let k = 0; k < half; k += 1) {
    power[k] = re[k] * re[k] + im[k] * im[k]
    if (frequencies[k] >= minFrequency && power[k] > max) max = power[k]
  }
  if (max > 0) for (let k = 0; k < half; k += 1) power[k] /= max

  const peaks = []
  for (let k = 1; k < half - 1; k += 1) {
    if (frequencies[k] < minFrequency) continue
    if (power[k] < minPeakFraction) continue
    if (!(power[k] > power[k - 1] && power[k] >= power[k + 1])) continue
    // Quadratic interpolation in log power for a sub-bin estimate.
    const a = Math.log(power[k - 1] + 1e-30)
    const b = Math.log(power[k] + 1e-30)
    const c = Math.log(power[k + 1] + 1e-30)
    const denom = a - 2 * b + c
    const offset = Math.abs(denom) > 1e-12 ? (0.5 * (a - c)) / denom : 0
    peaks.push({
      frequency: ((k + offset) * sampleRate) / size,
      power: power[k],
    })
  }

  peaks.sort((p, q) => q.power - p.power)
  return {
    sampleRate,
    size,
    frequencies,
    power,
    peaks: peaks.slice(0, maxPeaks),
    resolutionHz: sampleRate / size,
  }
}

/** Total power in a band, as a fraction of total power above the first bin. */
export function bandPower(spectrum, lowHz, highHz) {
  let inBand = 0
  let total = 0
  for (let k = 1; k < spectrum.frequencies.length; k += 1) {
    const f = spectrum.frequencies[k]
    if (f < 0) continue
    if (f <= highHz) total += spectrum.power[k]
    if (f >= lowHz && f <= highHz) inBand += spectrum.power[k]
  }
  return total > 0 ? inBand / total : 0
}
