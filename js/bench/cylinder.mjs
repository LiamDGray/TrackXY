/**
 * Side-view rotation accuracy: how much angle error does the chord projection
 * cause, and how much does inverting it recover?
 *
 * Geometry is the original apparatus: a marker on a strip around the
 * circumference of a ~1 ft dome, camera 2 ft (610 mm) from that circumference.
 * The marker's horizontal image position is r·sin θ, so a naive mm reading
 * under-reports angle; the asin inversion fixes the first-order error, and the
 * perspective term leaves a residual that grows with amplitude.
 */
import { analyze } from '../src/pipeline.js'
import { simulateRotation, observeCylinder, toCsv } from '../src/synthetic.js'

const RADIUS_MM = 152.5
const FREQUENCY = 0.8
const SECONDS = 12
const NOISE_PX = 0.2

console.log(`Side view — r = ${RADIUS_MM} mm, camera 610 mm, f = 600 px, noise σ = ${NOISE_PX} px\n`)
console.log('true θ | asin θ | err   | naive θ | err    | f err mHz')
console.log('-------|--------|-------|---------|--------|----------')

for (const amplitudeDeg of [5, 10, 20, 30, 45, 60, 75]) {
  const trajectory = simulateRotation({ amplitudeDeg, frequency: FREQUENCY, seconds: SECONDS, noisePx: NOISE_PX })
  const { rows, calibration } = observeCylinder(trajectory)
  const result = analyze({ csvText: toCsv(rows), calibration, radiusMm: RADIUS_MM })
  const rot = result.rotation
  const asinErr = ((rot.amplitudeDeg - amplitudeDeg) / amplitudeDeg) * 100
  const naiveErr = ((rot.naiveAmplitudeDeg - amplitudeDeg) / amplitudeDeg) * 100
  console.log(
    `${String(amplitudeDeg).padStart(6)}° | ${rot.amplitudeDeg.toFixed(2).padStart(6)}° | ${asinErr.toFixed(1).padStart(5)}% | ${rot.naiveAmplitudeDeg.toFixed(2).padStart(7)}° | ${naiveErr.toFixed(1).padStart(5)}% | ${((rot.frequencyHz - FREQUENCY) * 1000).toFixed(2).padStart(9)}`,
  )
}
