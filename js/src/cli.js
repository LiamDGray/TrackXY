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
import { analyze, formatReport } from './pipeline.js'
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
  const result = analyze({ csvText, calibration, units: options.units })

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    process.stdout.write(formatReport(result) + '\n')
  }
  return 0
}

const { command, options } = parseArgs(process.argv.slice(2))
try {
  const code = command === 'synthesize' ? synthesize(options) : command === 'analyze' ? run(options) : (() => {
    throw new Error(`unknown command: ${command ?? '(none)'}; expected analyze or synthesize`)
  })()
  process.exit(code)
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`)
  process.exit(2)
}
