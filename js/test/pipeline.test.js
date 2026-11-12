import test from 'node:test'
import assert from 'node:assert/strict'

import { analyze, formatReport } from '../src/pipeline.js'
import {
  simulateTrajectory,
  observe,
  cameraHomography,
  affineCalibrationFrom,
  toCsv,
} from '../src/synthetic.js'
import { fitHomography, reprojectionError, applyHomography } from '../src/calibration.js'

const CAMERA = { tiltDeg: 0 }

function makeCase({ tiltDeg = 0, radiusMm = 50, noisePx = 0.05, frequency = 0.8, seconds = 12 } = {}) {
  const camera = { tiltDeg }
  const trajectory = simulateTrajectory({ frequency, radiusMm, noisePx, seconds })
  const { H, rows } = observe(trajectory, camera)
  return { camera, H, rows, trajectory }
}

test('analyze recovers the simulated frequency from a clean synthetic run', () => {
  const { rows, camera, H } = makeCase()
  const affine = affineCalibrationFrom(H, camera)
  const result = analyze({ csvText: toCsv(rows), calibration: affine })
  assert.ok(Math.abs(result.axes.x.frequency - 0.8) < 1e-3, `f ${result.axes.x.frequency}`)
  assert.ok(Math.abs(result.axes.y.frequency - 0.8) < 1e-3, `f ${result.axes.y.frequency}`)
})

test('phase is quadrature for a circular trajectory', () => {
  const { rows } = makeCase()
  const result = analyze({ csvText: toCsv(rows) })
  assert.ok(Math.abs(Math.abs(result.phase.degrees) - 90) < 2, `phase ${result.phase.degrees}`)
  assert.match(result.phase.interpretation, /quadrature/)
})

test('homography calibration recovers the true radius where affine does not', () => {
  const tiltDeg = 25
  const radiusMm = 50
  const { rows, camera, H } = makeCase({ tiltDeg, radiusMm })
  const affine = affineCalibrationFrom(H, camera)

  const dst = [[-60, -60], [60, -60], [60, 60], [-60, 60]] // physical corners (mm)
  const src = dst.map((p) => pixelOf(H, p)) // where they appear (px)
  const Hfit = fitHomography(src, dst)
  const homography = {
    model: 'homography',
    H: Hfit,
    reprojectionPx: reprojectionError(Hfit, src, dst).max,
  }

  const affineResult = analyze({ csvText: toCsv(rows), calibration: affine })
  const homographyResult = analyze({ csvText: toCsv(rows), calibration: homography })

  const affineError = Math.abs(affineResult.axes.x.amplitude - radiusMm) / radiusMm
  const homographyError = Math.abs(homographyResult.axes.x.amplitude - radiusMm) / radiusMm

  assert.ok(homographyError < 0.02, `homography amplitude error ${homographyError}`)
  assert.ok(affineError > homographyError * 3, `affine ${affineError} vs homography ${homographyError}`)
})

function pixelOf(H, p) {
  return applyHomography(H, p)
}

test('analyze warns about affine calibration and about gaps', () => {
  const { rows, camera, H } = makeCase()
  const csv = toCsv(rows).replace('tracking', 'lost')
  const result = analyze({ csvText: csv, calibration: affineCalibrationFrom(H, camera) })
  assert.ok(result.warnings.some((w) => /affine calibration/.test(w)))
  assert.ok(result.warnings.some((w) => /gap/.test(w)))
})

test('analyze refuses too few samples', () => {
  const { rows } = makeCase({ seconds: 0.2 })
  assert.throws(() => analyze({ csvText: toCsv(rows) }), /at least 30/)
})

test('formatReport contains the headline numbers and the phase interpretation', () => {
  const { rows } = makeCase()
  const result = analyze({ csvText: toCsv(rows) })
  const report = formatReport(result)
  assert.match(report, /TrackXY analysis/)
  assert.match(report, /Hz/)
  assert.match(report, /phase \(Y − X\)/)
  assert.match(report, /samples/)
})
