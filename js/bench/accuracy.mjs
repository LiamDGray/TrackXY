/**
 * Closed-loop accuracy: does the analysis recover a motion we know exactly?
 *
 * Simulate a target on a tilted plane, observe it through the camera model with
 * pixel noise, write the CSV the tracker would write, and run the same analysis
 * the CLI runs. Two calibration models are compared: the uniform-scale affine
 * calibration the C++ build produces today, and a four-corner homography.
 *
 * Numbers from this script are quoted in docs/design/next-iteration.md and in
 * the technical article; keep the seeds and constants fixed.
 */
import { analyze } from '../src/pipeline.js'
import {
  simulateTrajectory,
  observe,
  affineCalibrationFrom,
  homographyCalibrationFrom,
  toCsv,
} from '../src/synthetic.js'
import { fitHomography, reprojectionError } from '../src/calibration.js'

const FREQUENCY = 0.8
const SECONDS = 12
const NOISE_PX = 0.2
const TILT_DEG = 25
const RADII = [10, 25, 50, 80]

function runCase({ radiusMm, tiltDeg, calibration }) {
  const camera = { tiltDeg }
  const trajectory = simulateTrajectory({ frequency: FREQUENCY, radiusMm, noisePx: NOISE_PX, seconds: SECONDS })
  const { H, rows } = observe(trajectory, camera)

  let cal = calibration
  if (cal === 'affine') {
    cal = affineCalibrationFrom(H, camera)
  } else {
    const target = homographyCalibrationFrom(H)
    const Hfit = fitHomography(target.src, target.dst)
    cal = {
      model: 'homography',
      H: Hfit,
      reprojectionPx: reprojectionError(Hfit, target.src, target.dst).max,
    }
  }

  const result = analyze({ csvText: toCsv(rows), calibration: cal })
  return {
    frequency: result.axes.x.frequency,
    amplitudeX: result.axes.x.amplitude,
    amplitudeY: result.axes.y.amplitude,
    reprojectionPx: cal.reprojectionPx ?? null,
  }
}

const fmt = (v, d = 3) => v.toFixed(d)
console.log(`Synthetic accuracy — f = ${FREQUENCY} Hz, ${SECONDS} s, noise σ = ${NOISE_PX} px, tilt ${TILT_DEG}°\n`)
console.log('radius | model       | f error mHz | x amp     | x err  | y amp     | y err  | re-projection')
console.log('-------|-------------|-------------|-----------|--------|-----------|--------|--------------')

for (const radiusMm of RADII) {
  for (const model of ['affine', 'homography']) {
    const r = runCase({ radiusMm, tiltDeg: TILT_DEG, calibration: model })
    const fErr = (r.frequency - FREQUENCY) * 1000
    const ex = ((r.amplitudeX - radiusMm) / radiusMm) * 100
    const ey = ((r.amplitudeY - radiusMm) / radiusMm) * 100
    console.log(
      `${String(radiusMm).padStart(6)} | ${model.padEnd(11)} | ${fmt(fErr, 2).padStart(11)} | ${fmt(r.amplitudeX, 3).padStart(9)} | ${fmt(ex, 2).padStart(5)}% | ${fmt(r.amplitudeY, 3).padStart(9)} | ${fmt(ey, 2).padStart(5)}% | ${r.reprojectionPx === null ? '  (n/a)' : `  ${fmt(r.reprojectionPx, 2)} px`}`,
    )
  }
}

console.log('\nControl: tilt 0° removes the difference between the models.')
for (const model of ['affine', 'homography']) {
  const r = runCase({ radiusMm: 50, tiltDeg: 0, calibration: model })
  const ex = ((r.amplitudeX - 50) / 50) * 100
  const ey = ((r.amplitudeY - 50) / 50) * 100
  console.log(`  ${model.padEnd(11)} x ${fmt(r.amplitudeX, 3)} mm (${fmt(ex, 2)}%), y ${fmt(r.amplitudeY, 3)} mm (${fmt(ey, 2)}%), f error ${fmt((r.frequency - FREQUENCY) * 1000, 2)} mHz`)
}
