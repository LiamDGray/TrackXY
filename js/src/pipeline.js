/**
 * End-to-end analysis: CSV + calibration -> oscillation parameters.
 *
 * This is the part of TrackXY that turns rows into a measurement, and it is
 * deliberately independent of the tracker. Whatever produced the coordinates —
 * the native LK tracker, a browser port, or a fiducial detector — the same
 * analysis runs, and the same warnings decide whether the result is worth
 * reporting.
 */

import { parseCsv, summariseRows } from './csv.js'
import { fitDampedSinusoid, phaseDifference } from './estimators.js'
import { applyHomography } from './calibration.js'

const MIN_SAMPLES = 30
const MIN_PERIODS = 3

/**
 * @param {object} options
 * @param {string} options.csvText raw CSV
 * @param {object} [options.calibration] {model:'homography', H, reprojectionPx} | {model:'affine', origin:[x,y], pixelsPerUnit}
 * @param {string} [options.units]
 */
export function analyze({ csvText, calibration = null, units = 'units', radiusMm = null }) {
  const rows = parseCsv(csvText)
  const gapInfo = summariseRows(rows)
  const warnings = []

  const usable = rows.filter((row) => row.tracking)
  if (usable.length < MIN_SAMPLES) {
    throw new Error(`only ${usable.length} tracking samples; need at least ${MIN_SAMPLES}`)
  }

  const times = usable.map((row) => row.milliseconds / 1000)
  const xs = []
  const ys = []

  for (const row of usable) {
    const [x, y] = project(row, calibration)
    xs.push(x)
    ys.push(y)
  }

  const fitX = fitDampedSinusoid(times, xs)
  // A side view of a rotating body carries one meaningful axis; fitting the
  // other would report the noise floor as an oscillation.
  const fitY = radiusMm ? null : fitDampedSinusoid(times, ys)

  if (!fitX.reliable && !radiusMm) warnings.push('X axis fit failed its reliability check; treat frequency as indicative')
  if (fitY && !fitY.reliable) warnings.push('Y axis fit failed its reliability check; treat frequency as indicative')

  const duration = times[times.length - 1] - times[0]
  const slowest = Math.max(fitX.frequency, fitY?.frequency ?? 0) || 1
  if (duration * slowest < MIN_PERIODS) {
    warnings.push(`record covers ${(duration * slowest).toFixed(1)} periods; ${MIN_PERIODS} or more is advisable`)
  }

  if (gapInfo.gaps > 0) {
    warnings.push(
      `${gapInfo.gaps} tracking gap(s), longest ${gapInfo.longestGap} frame(s) — the fit assumes even sampling`,
    )
  }

  if (calibration?.reprojectionPx !== undefined && calibration.reprojectionPx > 0.5) {
    warnings.push(
      `calibration reprojection error is ${calibration.reprojectionPx.toFixed(2)} px; re-calibration is advisable`,
    )
  }

  if (calibration?.model === 'affine' && !radiusMm) {
    warnings.push(
      'affine calibration: any camera tilt appears as amplitude error that grows with distance from the origin',
    )
  }

  const delta = fitY ? phaseDifference(fitY, fitX) : null

  // A marker on the circumference travels on a cylinder: the calibrated x is a
  // chord, r·sin θ. Inverting it turns the chord into an angle, which is the
  // quantity a rotational experiment actually wants.
  const rotation = radiusMm ? analyseRotation(times, xs, radiusMm, warnings) : null

  return {
    units,
    samples: usable.length,
    dropped: rows.length - usable.length,
    durationSeconds: duration,
    meanIntervalMs: (duration / (usable.length - 1)) * 1000,
    calibration: calibration ?? { model: 'none' },
    gapInfo,
    axes: { x: fitX, y: fitY },
    rotation,
    phase: delta
      ? {
          degrees: delta.degrees,
          standardError: delta.standardError,
          interpretation: describePhase(delta.degrees, delta.standardError),
        }
      : null,
    warnings,
  }
}

function project(row, calibration) {
  if (calibration?.model === 'homography') return applyHomography(calibration.H, [row.xPx, row.yPx])
  if (calibration?.model === 'affine') {
    const [ox, oy] = calibration.origin
    return [(row.xPx - ox) / calibration.pixelsPerUnit, (row.yPx - oy) / calibration.pixelsPerUnit]
  }
  if (row.xCal !== null && row.yCal !== null) return [row.xCal, row.yCal]
  return [row.xPx, row.yPx]
}

function describePhase(degrees, standardError) {
  if (Math.abs(degrees) < 2 * Math.max(standardError, 1)) return 'in phase (linear motion along one axis)'
  if (Math.abs(Math.abs(degrees) - 180) < 2 * Math.max(standardError, 1)) return 'anti-phase (linear motion, reversed)'
  if (Math.abs(degrees - 90) < 2 * Math.max(standardError, 1)) return 'quadrature (circular or elliptical orbit)'
  if (Math.abs(degrees + 90) < 2 * Math.max(standardError, 1)) return 'quadrature (circular or elliptical orbit, reversed)'
  return 'elliptical or non-orthogonal'
}

/** Human-readable report used by the CLI and by the tutorial transcript. */
export function formatReport(result) {
  const lines = []
  const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : 'n/a')

  lines.push('TrackXY analysis')
  lines.push(`  samples        ${result.samples} (${result.durationSeconds.toFixed(2)} s, ${result.meanIntervalMs.toFixed(1)} ms apart)`)
  lines.push(`  dropped        ${result.dropped} non-tracking row(s)`)
  const cal = result.calibration
  const calLabel =
    cal.model === 'homography'
      ? `homography (reprojection ${(cal.reprojectionPx ?? 0).toFixed(2)} px)`
      : cal.model === 'affine'
        ? `affine (${cal.pixelsPerUnit.toFixed(3)} px per ${result.units})`
        : 'none (using the coordinates as logged)'
  lines.push(`  calibration    ${calLabel}`)
  lines.push('')
  const axisList = result.rotation ? ['x'] : ['x', 'y']
  for (const axis of axisList) {
    const fit = result.axes[axis]
    lines.push(
      `  ${axis.toUpperCase()}  f = ${fmt(fit.frequency, 4)} Hz ± ${fmt(fit.standardErrors.frequency, 4)}` +
        `   amplitude = ${fmt(fit.amplitude, 3)} ${result.units} ± ${fmt(fit.standardErrors.amplitude, 3)}`,
    )
    lines.push(
      `     damping = ${fmt(fit.damping, 4)} /s   offset = ${fmt(fit.offset, 3)} ${result.units}` +
        `   ${fit.reliable ? 'reliable' : 'UNRELIABLE'}`,
    )
  }
  if (result.phase) {
    lines.push('')
    lines.push(
      `  phase (Y − X)  ${fmt(result.phase.degrees, 2)}° ± ${fmt(result.phase.standardError, 2)}°  — ${result.phase.interpretation}`,
    )
  }
  if (result.rotation) {
    const rot = result.rotation
    lines.push('')
    lines.push(
      `  rotation       ${fmt(rot.amplitudeDeg, 1)}° ± ${fmt(rot.amplitudeDegStandardError, 2)}° at ${rot.radiusMm} mm radius`,
    )
    lines.push(
      `     chord ${fmt(rot.chordAmplitudeMm, 2)} mm; small-angle shortcut would say ${fmt(rot.naiveAmplitudeDeg, 1)}°` +
        `   ${rot.reliable ? 'reliable' : 'UNRELIABLE'}`,
    )
  }

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('  warnings')
    for (const warning of result.warnings) lines.push(`   - ${warning}`)
  }
  return lines.join('\n')
}


/**
 * Convert a chord to an angle and fit the angle series.
 *
 * The small-angle shortcut (θ ≈ x/r) is what a chord in millimetres usually gets
 * mistaken for; it is 10% low at 45° and 26% low at 75°. `asin` is the correct
 * inversion for a side view without perspective, and the perspective residual is
 * reported by the fit's own residual rather than hidden.
 */
export function chordToAngle(x, radiusMm) {
  if (!(radiusMm > 0)) throw new Error('radiusMm must be positive')
  const ratio = Math.max(-0.999999, Math.min(0.999999, x / radiusMm))
  return Math.asin(ratio)
}

function analyseRotation(times, xs, radiusMm, warnings) {
  const radians = xs.map((x) => chordToAngle(x, radiusMm))
  const fit = fitDampedSinusoid(times, radians)
  const chordAmplitudeMm = Math.max(...xs.map(Math.abs))
  const naiveDeg = (chordAmplitudeMm / radiusMm) * (180 / Math.PI)

  if (chordAmplitudeMm > radiusMm) {
    warnings.push('chord exceeds the stated radius; check the radius or the calibration')
  }
  if (!fit.reliable) warnings.push('rotation fit failed its reliability check')
  const amplitudeDeg = Math.abs(fit.amplitude) * (180 / Math.PI)
  const naiveError = ((naiveDeg - amplitudeDeg) / (amplitudeDeg || 1)) * 100
  if (Math.abs(naiveError) > 2) {
    warnings.push(
      `small-angle shortcut would report ${naiveDeg.toFixed(1)}° instead of ${amplitudeDeg.toFixed(1)}° (${Math.abs(naiveError).toFixed(0)}% low)`,
    )
  }
  if (amplitudeDeg > 30) {
    warnings.push(
      'amplitude above 30°: the asin inversion ignores the perspective term and under-reports by several percent',
    )
  }

  return {
    radiusMm,
    amplitudeDeg,
    amplitudeDegStandardError: fit.standardErrors.amplitude * (180 / Math.PI),
    frequencyHz: fit.frequency,
    damping: fit.damping,
    chordAmplitudeMm,
    naiveAmplitudeDeg: naiveDeg,
    reliable: fit.reliable,
  }
}
