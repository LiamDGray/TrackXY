import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fitHomography,
  applyHomography,
  invertHomography,
  reprojectionError,
  localScale,
} from '../src/calibration.js'

/** Camera looking at a plane tilted by `tiltDeg` about the x axis. */
function tiltedPlaneHomography({ tiltDeg = 25, focalPx = 800, distanceMm = 600, cx = 320, cy = 240 } = {}) {
  const t = (tiltDeg * Math.PI) / 180
  // Plane axes in camera coordinates, and the plane origin's camera position.
  const r1 = [1, 0, 0]
  const r2 = [0, Math.cos(t), Math.sin(t)]
  const origin = [0, 0, distanceMm]
  // H = K [r1 r2 origin]: maps plane (mm) -> pixels.
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

test('fitHomography recovers a known projective mapping', () => {
  const H = [
    [1.2, 0.1, 30],
    [0.05, 0.9, 20],
    [0.001, 0.0005, 1],
  ]
  const src = [
    [0, 0],
    [100, 0],
    [100, 80],
    [0, 80],
    [40, 55],
  ]
  const dst = src.map((p) => applyHomography(H, p))
  const fitted = fitHomography(src, dst)

  for (const p of [[12, 33], [77, 12], [50, 50], [99, 79]]) {
    const expected = applyHomography(H, p)
    const actual = applyHomography(fitted, p)
    assert.ok(Math.abs(expected[0] - actual[0]) < 1e-6, `x ${expected[0]} vs ${actual[0]}`)
    assert.ok(Math.abs(expected[1] - actual[1]) < 1e-6, `y ${expected[1]} vs ${actual[1]}`)
  }
})

test('invertHomography round-trips', () => {
  const H = [
    [1.1, -0.2, 12],
    [0.3, 0.95, -7],
    [0.0008, 0.0012, 1],
  ]
  const inv = invertHomography(H)
  const p = [63.5, 18.25]
  const back = applyHomography(inv, applyHomography(H, p))
  assert.ok(Math.abs(back[0] - p[0]) < 1e-9)
  assert.ok(Math.abs(back[1] - p[1]) < 1e-9)
})

test('fewer than four correspondences is rejected', () => {
  assert.throws(() => fitHomography([[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]]), /four/i)
})

test('homography removes tilt error that a uniform scale cannot', () => {
  const tiltDeg = 25
  const H = tiltedPlaneHomography({ tiltDeg })

  // Four corners of a 120 mm calibration square centred on the plane origin.
  const cornersMm = [
    [-60, -60],
    [60, -60],
    [60, 60],
    [-60, 60],
  ]
  const cornersPx = cornersMm.map((p) => applyHomography(H, p))
  const fitted = fitHomography(cornersMm, cornersPx)

  assert.ok(reprojectionError(fitted, cornersMm, cornersPx).max < 1e-9)

  // What the current C++ calibration does: a single scale about the origin.
  const centrePx = applyHomography(H, [0, 0])
  const { mean: scalePxPerMm } = localScale(fitted, [0, 0])
  const affineErrorAt = (radiusMm, samples = 24) => {
    let worst = 0
    for (let i = 0; i < samples; i += 1) {
      const a = (2 * Math.PI * i) / samples
      const truth = [radiusMm * Math.cos(a), radiusMm * Math.sin(a)]
      const px = applyHomography(H, truth)
      const predicted = [(px[0] - centrePx[0]) / scalePxPerMm, (px[1] - centrePx[1]) / scalePxPerMm]
      worst = Math.max(worst, Math.hypot(predicted[0] - truth[0], predicted[1] - truth[1]))
    }
    return worst
  }

  // The homography maps every point back exactly; the affine model drifts with
  // distance from the origin, which is the parallax the old calibration ignores.
  const near = affineErrorAt(10)
  const far = affineErrorAt(50)
  // Measured with this geometry: 0.55 mm at r=10, 4.06 mm at r=50.
  assert.ok(near < 1.0, `near ${near}`)
  assert.ok(far > 5 * near, `far ${far} should exceed near ${near} by 5x`)
  assert.ok(far > 3.0, `far ${far} mm should exceed 3 mm at 50 mm radius`)
})

test('localScale reports pixels per unit at a point', () => {
  const H = tiltedPlaneHomography({ tiltDeg: 0, focalPx: 800, distanceMm: 600 })
  const { mean } = localScale(H, [0, 0])
  // 800 px focal at 600 mm => 800/600 px per mm.
  assert.ok(Math.abs(mean - 800 / 600) < 1e-6, `scale ${mean}`)
})
