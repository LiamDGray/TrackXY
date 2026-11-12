/**
 * Planar calibration geometry.
 *
 * The C++ implementation maps pixels to units with a translation and a uniform
 * scale, which is exact only when the camera is square-on to the target plane.
 * Any tilt introduces parallax that grows with distance from the calibration
 * origin, and no uniform scale can remove it. A homography can: four or more
 * correspondences in the plane determine the full projective mapping, so the
 * measurement is corrected for camera angle rather than assumed to be immune.
 *
 * Marker height above the plane is a separate error and is not corrected here —
 * see docs/design/next-iteration.md.
 */

/** Normalise points so the centroid is at the origin and mean distance is √2. */
function normalise(points) {
  const n = points.length
  let cx = 0
  let cy = 0
  for (const [x, y] of points) {
    cx += x
    cy += y
  }
  cx /= n
  cy /= n

  let meanDist = 0
  for (const [x, y] of points) meanDist += Math.hypot(x - cx, y - cy)
  meanDist /= n
  const scale = meanDist > 1e-12 ? Math.SQRT2 / meanDist : 1

  const T = [
    [scale, 0, -scale * cx],
    [0, scale, -scale * cy],
    [0, 0, 1],
  ]
  const out = points.map(([x, y]) => [scale * (x - cx), scale * (y - cy)])
  return { points: out, T }
}

export function applyHomography(H, [x, y]) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2]
  if (Math.abs(w) < 1e-15) throw new Error('point maps to infinity')
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  ]
}

function multiply3(A, B) {
  const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let sum = 0
      for (let k = 0; k < 3; k += 1) sum += A[i][k] * B[k][j]
      out[i][j] = sum
    }
  }
  return out
}

export function invertHomography(H) {
  const [[a, b, c], [d, e, f], [g, h, i]] = H
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-15) throw new Error('homography is singular')
  const inv = [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ]
  return inv
}

function solveLinear(A, b) {
  const n = b.length
  const m = A.map((row) => row.slice())
  const y = b.slice()
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-14) throw new Error('degenerate point configuration')
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

/**
 * Fit H such that dst ≈ H · src. Direct linear transform with Hartley
 * normalisation, least squares over all pairs (exact for four).
 */
export function fitHomography(src, dst) {
  if (src.length !== dst.length) throw new Error('source and destination lengths differ')
  if (src.length < 4) throw new Error('need at least four correspondences')

  const ns = normalise(src)
  const nd = normalise(dst)

  const rows = []
  const rhs = []
  for (let i = 0; i < ns.points.length; i += 1) {
    const [x, y] = ns.points[i]
    const [u, v] = nd.points[i]
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    rhs.push(u)
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    rhs.push(v)
  }

  const normal = Array.from({ length: 8 }, () => new Array(8).fill(0))
  const target = new Array(8).fill(0)
  for (let r = 0; r < rows.length; r += 1) {
    for (let i = 0; i < 8; i += 1) {
      target[i] += rows[r][i] * rhs[r]
      for (let j = 0; j < 8; j += 1) normal[i][j] += rows[r][i] * rows[r][j]
    }
  }

  const h = solveLinear(normal, target)
  const Hn = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ]

  // Undo normalisation: H = Td⁻¹ · Hn · Ts
  return multiply3(multiply3(invertHomography(nd.T), Hn), ns.T)
}

export function reprojectionError(H, src, dst) {
  let worst = 0
  let sum = 0
  for (let i = 0; i < src.length; i += 1) {
    const [u, v] = applyHomography(H, src[i])
    const err = Math.hypot(u - dst[i][0], v - dst[i][1])
    sum += err
    if (err > worst) worst = err
  }
  return { rms: Math.sqrt(sum / src.length), max: worst }
}

/**
 * Equivalent uniform scale at a point, in units per pixel, from the homography's
 * local Jacobian. Useful for reporting the scale the old affine calibration
 * would have used, and for estimating parallax sensitivity.
 */
export function localScale(H, [x, y], delta = 1) {
  const p0 = applyHomography(H, [x, y])
  const px = applyHomography(H, [x + delta, y])
  const py = applyHomography(H, [x, y + delta])
  const sx = Math.hypot(px[0] - p0[0], px[1] - p0[1]) / delta
  const sy = Math.hypot(py[0] - p0[0], py[1] - p0[1]) / delta
  return { x: sx, y: sy, mean: (sx + sy) / 2 }
}
