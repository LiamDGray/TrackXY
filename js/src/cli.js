#!/usr/bin/env node
/**
 * Command-line front end for the portable analysis core.
 *
 *   node src/cli.js analyze --csv out.csv [--calib calib.json] [--json]
 *   node src/cli.js synthesize --out sample.csv [--tilt 25] [--radius 50]
 *
 * `synthesize` exists so the tutorial is runnable without a camera, and so the
 * accuracy harness has a reproducible input.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { analyze, formatReport, projectSeries } from './pipeline.js'
import { analyzeBalance, TORSION_DEFAULTS } from './balance.js'
import { periodogram } from './spectrum.js'
import { fitHomography, reprojectionError } from './calibration.js'
import {
  simulateTrajectory,
  observe,
  cameraHomography,
  affineCalibrationFrom,
  homographyCalibrationFrom,
  toCsv,
} from './synthetic.js'

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = { units: 'mm' }
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`)
    const key = arg.slice(2)
    if (key === 'json') {
      options.json = true
      continue
    }
    const value = rest[i + 1]
    if (value === undefined) throw new Error(`missing value for --${key}`)
    options[key] = value
    i += 1
  }
  return { command, options }
}

/** Load a calibration description and, for homographies, compute H and its error. */
export function loadCalibration(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  if (raw.model === 'affine') {
    if (!Array.isArray(raw.origin) || raw.origin.length !== 2) throw new Error('affine calibration needs origin [x, y]')
    if (!Number.isFinite(raw.pixelsPerUnit) || raw.pixelsPerUnit <= 0) {
      throw new Error('affine calibration needs a positive pixelsPerUnit')
    }
    return { model: 'affine', origin: raw.origin, pixelsPerUnit: raw.pixelsPerUnit }
  }
  if (raw.model === 'homography') {
    if (!Array.isArray(raw.src) || !Array.isArray(raw.dst) || raw.src.length < 4 || raw.src.length !== raw.dst.length) {
      throw new Error('homography calibration needs src/dst arrays of four or more matching points')
    }
    const H = fitHomography(raw.src, raw.dst)
    const error = reprojectionError(H, raw.src, raw.dst)
    return { model: 'homography', H, reprojectionPx: error.max, rmsPx: error.rms }
  }
  throw new Error(`unknown calibration model: ${raw.model}`)
}

function balance(options) {
  if (!options.csv) throw new Error('--csv is required')
  const csvText = readFileSync(options.csv, 'utf8')
  const calibration = options.calib ? loadCalibration(options.calib) : null
  const { times, xs } = projectSeries({ csvText, calibration })

  const torsion = {
    cmPerDeg: Number(options['cm-per-deg'] ?? TORSION_DEFAULTS.cmPerDeg),
    mgPerDeg: Number(options['mg-per-deg'] ?? TORSION_DEFAULTS.mgPerDeg),
  }
  const windowSeconds = Number(options.window ?? 300)
  const result = analyzeBalance(times, xs, { windowSeconds, torsion })
  const spectrum = periodogram(times, result.residual, { maxPeaks: 5, detrend: 1, minFrequency: 0.004 })

  if (options.json) {
    const { residual, segments, residualSegments, ...summary } = result
    process.stdout.write(
      JSON.stringify({ ...summary, segments, residualSegments, spectrum: { peaks: spectrum.peaks, resolutionHz: spectrum.resolutionHz } }, null, 2) + '\n',
    )
    return 0
  }

  const f = (v, d = 2) => v.toFixed(d)
  const duration = times[times.length - 1] - times[0]
  const lines = []
  lines.push('Torsion balance analysis')
  lines.push(`  samples        ${times.length} (${f(duration, 1)} s, ${f(times.length / duration, 2)} Hz)`)
  lines.push(`  windows        ${result.segments.length} × ${windowSeconds} s`)
  lines.push('')
  lines.push(`  centre shift   ${f(result.cooShiftCm)} cm = ${f(result.cooShiftDeg, 1)}° = ${f(result.cooShiftMg, 0)} mg equivalent`)
  lines.push(`  amplitude      half peak-to-peak max ${f(result.amplitudeMaxCm)} cm; peak-to-peak ${f(result.peakToPeakMaxCm)} cm`)
  lines.push(
    `  relaxation     τ = ${f(result.relaxation.tau, 0)} s from onset ≈ ${f(result.relaxation.onset, 0)} s, R² = ${f(result.relaxation.rSquared, 3)}`,
  )
  lines.push('')
  lines.push('  spectrum')
  for (const peak of spectrum.peaks) {
    lines.push(`   - ${f(peak.frequency, 4)} Hz  (${f(peak.power * 100, 0)}% of strongest)`)
  }
  process.stdout.write(lines.join('\n') + '\n')
  return 0
}

function synthesize(options) {
  const tiltDeg = Number(options.tilt ?? 25)
  const radiusMm = Number(options.radius ?? 50)
  const frequency = Number(options.frequency ?? 0.8)
  const noisePx = Number(options.noise ?? 0.2)
  const eccentricity = Number(options.eccentricity ?? 1)
  const seconds = Number(options.seconds ?? 12)

  const trajectory = simulateTrajectory({ frequency, radiusMm, noisePx, eccentricity, seconds })
  const camera = { tiltDeg }
  const { H, rows } = observe(trajectory, camera)
  const affine = affineCalibrationFrom(H, camera)
  const csv = toCsv(rows, { affine })

  const out = options.out ?? 'synthetic.csv'
  writeFileSync(out, csv)
  writeFileSync(
    out.replace(/\.csv$/, '') + '.calibration-affine.json',
    JSON.stringify(affine, null, 2) + '\n',
  )
  writeFileSync(
    out.replace(/\.csv$/, '') + '.calibration-homography.json',
    JSON.stringify(homographyCalibrationFrom(H), null, 2) + '\n',
  )
  process.stdout.write(
    `wrote ${out} (${rows.length} rows), ${out.replace(/\.csv$/, '')}.calibration-{affine,homography}.json\n`,
  )
  process.stdout.write(
    `truth: frequency ${frequency} Hz, amplitude ${radiusMm} mm, tilt ${tiltDeg}°\n`,
  )
  return 0
}

function run(options) {
  if (!options.csv) throw new Error('--csv is required')
  const csvText = readFileSync(options.csv, 'utf8')
  const calibration = options.calib ? loadCalibration(options.calib) : null
  const radiusMm = options.radius ? Number(options.radius) : null
  if (options.radius && !(radiusMm > 0)) throw new Error('--radius must be a positive number')
  const result = analyze({ csvText, calibration, units: options.units, radiusMm })

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    process.stdout.write(formatReport(result) + '\n')
  }
  return 0
}

const { command, options } = parseArgs(process.argv.slice(2))
try {
  const handlers = { analyze: run, balance, synthesize }
  const code = handlers[command] ? handlers[command](options) : (() => {
    throw new Error(`unknown command: ${command ?? '(none)'}; expected analyze, balance or synthesize`)
  })()
  process.exit(code)
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`)
  process.exit(2)
}
