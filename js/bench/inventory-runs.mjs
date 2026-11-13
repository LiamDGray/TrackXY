#!/usr/bin/env node
/**
 * Inventory a directory of TrackXY captures and judge which are usable.
 *
 *   node bench/inventory-runs.mjs <dir> [<dir> ...] [--band 0.015,0.06]
 *
 * For every CSV it finds, report the schema, row count, duration, sample rate,
 * and whether the record could support a period estimate. The point is triage:
 * after a machine change or a years-old backup, the useful question is not
 * "which file is newest" but "which file has a stable track and enough cycles".
 *
 * Nothing here reads image or video data; it is a CSV triage tool.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadSeries } from './fits-report.mjs'

function parseArgs(argv) {
  const dirs = []
  let band = [0.015, 0.06]
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--band') {
      band = argv[i + 1].split(',').map(Number)
      i += 1
    } else if (!argv[i].startsWith('--')) {
      dirs.push(argv[i])
    }
  }
  return { dirs: dirs.length ? dirs : ['.'], band }
}

function* walk(dir, depth = 0) {
  if (depth > 4) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path, depth + 1)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) yield path
  }
}

function quantile(sorted, q) {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** Decide whether a series looks like a measurement run or a tracking test. */
export function classify(series, band) {
  const { t, x, y } = series
  const n = t.length
  if (n < 10) return { verdict: 'unusable: fewer than 10 samples', stats: { n } }

  const duration = t[n - 1] - t[0]
  const rate = (n - 1) / duration
  const xs = [...x].sort((a, b) => a - b)
  const spread = quantile(xs, 0.95) - quantile(xs, 0.05)

  // Jumpiness: adjacent samples that move a large fraction of the spread. A real
  // oscillation moves smoothly; a tracker that loses and re-acquires the target
  // jumps.
  let jumpy = 0
  for (let i = 1; i < n; i += 1) {
    if (Math.abs(x[i] - x[i - 1]) > 0.25 * (spread || 1)) jumpy += 1
  }
  const jumpFraction = n > 1 ? jumpy / (n - 1) : 0

  // Stuck: the longest run of identical coordinates, as a fraction of the record.
  let longestStuck = 1
  let run = 1
  for (let i = 1; i < n; i += 1) {
    if (x[i] === x[i - 1] && y[i] === y[i - 1]) run += 1
    else run = 1
    if (run > longestStuck) longestStuck = run
  }
  const stuckFraction = longestStuck / n

  const cycles = duration * ((band[0] + band[1]) / 2)

  let verdict
  if (duration < 60) {
    verdict = 'too short: under a minute, cannot measure a ~30 s period'
  } else if (jumpFraction > 0.1 || stuckFraction > 0.05) {
    verdict = 'tracking unstable: jumps or stuck segments, not a clean measurement run'
  } else if (cycles < 3) {
    verdict = `short: about ${cycles.toFixed(1)} cycles at ${(((band[0] + band[1]) / 2) * 1).toFixed(3)} Hz`
  } else {
    verdict = `candidate: ${cycles.toFixed(0)} cycles, stable tracking`
  }

  return {
    verdict,
    stats: {
      n,
      duration,
      rate,
      spread,
      jumpFraction,
      stuckFraction,
      cycles,
    },
  }
}

function main() {
  const { dirs, band } = parseArgs(process.argv.slice(2))
  const rows = []
  for (const dir of dirs) {
    for (const path of walk(dir)) {
      let series
      try {
        const size = statSync(path).size
        if (size > 50e6) {
          rows.push({ path, verdict: `skipped: ${(size / 1e6).toFixed(0)} MB`, stats: {} })
          continue
        }
        series = loadSeries(readFileSync(path, 'utf8'))
      } catch (error) {
        rows.push({ path, verdict: `unreadable: ${error.message}`, stats: {} })
        continue
      }
      const { verdict, stats } = classify(series, band)
      rows.push({ path, schema: series.source, verdict, stats })
    }
  }

  if (rows.length === 0) {
    process.stdout.write('no CSV files found\n')
    return
  }

  process.stdout.write(`| file | schema | rows | duration | rate | verdict |\n|---|---|---|---|---|---|\n`)
  for (const row of rows) {
    const s = row.stats
    process.stdout.write(
      `| ${row.path} | ${row.schema ?? '—'} | ${s.n ?? '—'} | ${s.duration ? `${s.duration.toFixed(1)} s` : '—'} | ${s.rate ? `${s.rate.toFixed(1)} Hz` : '—'} | ${row.verdict} |\n`,
    )
  }
  const candidates = rows.filter((r) => r.verdict.startsWith('candidate'))
  process.stdout.write(`\n${rows.length} file(s), ${candidates.length} candidate measurement run(s)\n`)
}

const invokedDirectly = process.argv[1]?.endsWith('inventory-runs.mjs') ?? false
if (invokedDirectly) main()
