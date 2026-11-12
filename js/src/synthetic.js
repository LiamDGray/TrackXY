/**
 * Synthetic observation generator.
 *
 * Produces the same CSV the tracker writes, for a target whose motion is known
 * exactly. That makes two things testable without a camera: whether the analysis
 * recovers the truth, and how much error a given calibration model contributes.
 *
 * The camera model is a pinhole looking at a plane tilted by `tiltDeg`; the
 * target moves in that plane in millimetres. Noise is Gaussian in pixels, which
 * is the regime the estimator benchmark assumes.
 */

import { applyHomography } from './calibration.js'

/** Plane (mm) -> pixel homography for a camera at `distanceMm`, tilted about x. */
export function cameraHomography({ tiltDeg = 0, focalPx = 800, distanceMm = 600, cx = 320, cy = 240 } = {}) {
  const t = (tiltDeg * Math.PI) / 180
  const r1 = [1, 0, 0]
  const r2 = [0, Math.cos(t), Math.sin(t)]
  const origin = [0, 0, distanceMm]
  const K = [
    [focalPx, 0, cx],
    [0, focalPx, cy],
    [0, 0, 1],
  ]
  const M = [
    [r1[0], r2[0], origin[0]],
    [r1[1], r2[1], origin[1]],
    [r1[2], r2[2], origin[2]],
  ]
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let sum = 0
      for (let k = 0; k < 3; k += 1) sum += K[i][k] * M[k][j]
      H[i][j] = sum
    }
  }
  return H
}

function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    const u1 = (s + 0.5) / 4294967296
    s = (s * 1664525 + 1013904223) >>> 0
    const u2 = (s + 0.5) / 4294967296
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
}

/**
 * A target tracing an ellipse in the plane:
 *   x(t) = radiusMm · cos(2πft + φ)
 *   y(t) = radiusMm · eccentricity · sin(2πft + φ)
 * with an exponential envelope of `damping` per second.
 */
export function simulateTrajectory({
  frequency = 0.8,
  radiusMm = 50,
  eccentricity = 1,
  damping = 0,
  phase = 0,
  seconds = 12,
  fps = 60,
  noisePx = 0.2,
  seed = 20261112,
} = {}) {
  const rand = makeRng(seed)
  const n = Math.round(seconds * fps)
  const truth = []
  for (let i = 0; i < n; i += 1) {
    const t = i / fps
    const envelope = Math.exp(-damping * t)
    truth.push({
      t,
      x: radiusMm * envelope * Math.cos(2 * Math.PI * frequency * t + phase),
      y: radiusMm * eccentricity * envelope * Math.sin(2 * Math.PI * frequency * t + phase),
    })
  }
  return { truth, rand, noisePx }
}

/** Camera pixels for a trajectory, with noise. */
export function observe(trajectory, camera = {}) {
  const H = cameraHomography(camera)
  const rows = []
  for (const point of trajectory.truth) {
    const [px, py] = applyHomography(H, [point.x, point.y])
    rows.push({
      milliseconds: Math.round(point.t * 1000),
      xPx: px + trajectory.noisePx * trajectory.rand(),
      yPx: py + trajectory.noisePx * trajectory.rand(),
      truth: point,
    })
  }
  return { H, rows }
}

/**
 * The calibration a careful operator obtains today: a single scale measured at
 * the origin plus an origin offset. This is what the C++ build writes to
 * calibration.yml when the operator presses `k` and `o`.
 */
export function affineCalibrationFrom(H, { focalPx = 800, distanceMm = 600, cx = 320, cy = 240 } = {}) {
  const scalePxPerUnit = focalPx / distanceMm
  return { model: 'affine', origin: [cx, cy], pixelsPerUnit: scalePxPerUnit }
}

/**
 * Four-corner homography calibration of a square of `sizeMm`, centred on the
 * plane origin. Convention: `src` points are where the corners appear in the
 * image (pixels), `dst` points are their physical positions (units), so the
 * fitted H maps pixels -> units, which is the direction analysis needs.
 */
export function homographyCalibrationFrom(H, sizeMm = 120) {
  const half = sizeMm / 2
  const dst = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  const src = dst.map((p) => applyHomography(H, p))
  return { model: 'homography', src, dst }
}

export function toCsv(rows, { units = 'mm', affine = null } = {}) {
  const lines = ['samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status']
  lines.push('0, 0, 0, 0, 0, 0, Start: synthetic')
  rows.forEach((row, i) => {
    symbolSafePush(lines, row, i, affine)
  })
  return `${lines.join('\n')}\n`

  function symbolSafePush(target, row, i, affineModel) {
    let xCal = ''
    let yCal = ''
    if (affineModel) {
      const [ox, oy] = affineModel.origin
      xCal = ((row.xPx - ox) / affineModel.pixelsPerUnit).toFixed(6)
      yCal = ((row.yPx - oy) / affineModel.pixelsPerUnit).toFixed(6)
    }
    target.push(
      [
        i + 1,
        row.milliseconds,
        row.xPx.toFixed(4),
        row.yPx.toFixed(4),
        xCal,
        yCal,
        'tracking',
      ].join(','),
    )
  }
}

/**
 * Rotation about a vertical axis, seen from the side.
 *
 * This is the geometry of the original apparatus: a marker on a strip around the
 * circumference of a dome, filmed from roughly two feet away. The marker travels
 * on a *cylinder*, so its horizontal image position is a chord, `x = r·sin θ`,
 * not an arc. For small oscillations the two are nearly equal; at ±45° the chord
 * reads 10% low, and at ±75° it reads 26% low.
 *
 * `simulateRotation` produces the true angle; `observeCylinder` projects it
 * through the camera, including the perspective term that a planar calibration
 * cannot see.
 */
export function simulateRotation({
  frequency = 0.8,
  amplitudeDeg = 20,
  damping = 0,
  phase = 0,
  seconds = 12,
  fps = 60,
  noisePx = 0.2,
  seed = 20261112,
  radialNoisePx = 0,
} = {}) {
  const rand = makeRng(seed)
  const n = Math.round(seconds * fps)
  const amplitude = (amplitudeDeg * Math.PI) / 180
  const truth = []
  for (let i = 0; i < n; i += 1) {
    const t = i / fps
    truth.push({ t, theta: amplitude * Math.exp(-damping * t) * Math.sin(2 * Math.PI * frequency * t + phase) })
  }
  return { truth, rand, noisePx, radialNoisePx }
}

/** Camera pixels for a rotation, as the marker appears on the cylinder's near side. */
export function observeCylinder(
  trajectory,
  { radiusMm = 152.5, distanceMm = 610, focalPx = 600, cx = 320, cy = 240 } = {},
) {
  const rows = []
  for (const point of trajectory.truth) {
    const theta = point.theta
    const X = radiusMm * Math.sin(theta)
    const Z = distanceMm + radiusMm * (1 - Math.cos(theta))
    const xPx = cx + (focalPx * X) / Z
    const yPx = cy + trajectory.noisePx * trajectory.rand()
    rows.push({
      milliseconds: Math.round(point.t * 1000),
      xPx: xPx + trajectory.noisePx * trajectory.rand() + trajectory.radialNoisePx * 0,
      yPx,
      truth: point,
    })
  }
  // Affine calibration of the near-side plane: the scale a careful operator
  // would measure, and the model that silently ignores the perspective term.
  const calibration = { model: 'affine', origin: [cx, cy], pixelsPerUnit: focalPx / distanceMm }
  return { rows, calibration }
}
