#!/usr/bin/env node
/**
 * Run every available estimator against a recording and report all of them,
 * including the ones that fail. Failures are the point: an estimator that
 * refuses, or that returns a wildly different answer from its neighbours, is
 * telling you the record cannot support the claim.
 *
 *   node bench/fits-report.mjs --csv run.csv [--label name] [--band 0.002,0.2]
 *
 * Accepts both the current schema and the 2012 legacy schema
 * (`samplenumber, millseconds, x, y, numclicks, comments or notes`).
 */
import { readFileSync } from 'node:fs'
import { parseCsv } from '../src/csv.js'
import { fitDampedSinusoid, zeroCrossingEstimate } from '../src/estimators.js'
import { lombScargle } from '../src/lomb.js'
import { periodogram } from '../src/spectrum.js'

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]
  return out
}

/** Read either schema into { t, x, y, source }. */
export function loadSeries(text) {
  const firstLine = text.split('\n', 1)[0].toLowerCase()
  if (firstLine.includes('x_px')) {
    const rows = parseCsv(text).filter((r) => r.tracking)
    const usable = rows
    return {
      source: 'current schema',
      t: usable.map((r) => r.milliseconds / 1000),
      x: usable.map((r) => (r.xCal ?? r.xPx)),
      y: usable.map((r) => (r.yCal ?? r.yPx)),
    }
  }

  // Legacy schema. The first rows are configuration echoes, not samples.
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  const header = lines[0].toLowerCase().split(',').map((s) => s.trim())
  const iMs = header.findIndex((h) => h === 'millseconds' || h === 'milliseconds')
  const iX = header.indexOf('x')
  const iY = header.indexOf('y')
  const iClicks = header.indexOf('numclicks')
  const t = []
  const x = []
  const y = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(',')
    const clicks = Number(cells[iClicks] ?? 0)
    if (!Number.isFinite(clicks) || clicks < 1) continue
    const ms = Number(cells[iMs])
    const xv = Number(cells[iX])
    const yv = Number(cells[iY])
    if (!Number.isFinite(ms) || !Number.isFinite(xv)) continue
    t.push(ms / 1000)
    x.push(xv)
    y.push(yv)
  }
  return { source: 'legacy 2012 schema', t, x, y }
}

const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export function report(label, series, band) {
  const { t, x } = series
  const n = t.length
  const duration = n > 1 ? t[n - 1] - t[0] : 0
  const rate = n > 1 ? (n - 1) / duration : 0
  const rows = []

  const zc = zeroCrossingEstimate(t, x)
  rows.push({
    method: 'zero-crossing (C++ baseline)',
    f: zc.frequency,
    se: NaN,
    flag: zc.frequency === 0 ? 'no estimate (fewer than 4 crossings)' : 'point estimate only',
  })

  let lsPeak = null
  try {
    const ls = lombScargle(t, x, { minFrequency: band[0], maxFrequency: band[1] })
    lsPeak = ls.peak.frequency
    rows.push({
      method: 'Lomb–Scargle',
      f: ls.peak.frequency,
      se: NaN,
      flag: `FAP ${ls.peak.fap < 1e-4 ? '<1e-4' : ls.peak.fap.toFixed(3)}`,
    })
  } catch (error) {
    rows.push({ method: 'Lomb–Scargle', f: NaN, se: NaN, flag: `failed: ${error.message}` })
  }

  try {
    const fit = fitDampedSinusoid(t, x)
    rows.push({
      method: 'damped sinusoid (LM, zero-crossing seed)',
      f: fit.frequency,
      se: fit.standardErrors.frequency,
      flag: fit.reliable ? 'reliable' : 'REJECTED by its own reliability check',
    })
  } catch (error) {
    rows.push({ method: 'damped sinusoid (LM, zero-crossing seed)', f: NaN, se: NaN, flag: `failed: ${error.message}` })
  }

  if (lsPeak) {
    try {
      const fit = fitDampedSinusoid(t, x, { initialFrequency: lsPeak })
      rows.push({
        method: 'damped sinusoid (LM, spectral seed)',
        f: fit.frequency,
        se: fit.standardErrors.frequency,
        flag: fit.reliable ? 'reliable' : 'REJECTED by its own reliability check',
      })
    } catch (error) {
      rows.push({ method: 'damped sinusoid (LM, spectral seed)', f: NaN, se: NaN, flag: `failed: ${error.message}` })
    }
  }

  try {
    const fft = periodogram(t, x, { detrend: 1, minFrequency: band[0], maxPeaks: 1 })
    rows.push({
      method: 'FFT periodogram',
      f: fft.peaks[0]?.frequency ?? NaN,
      se: NaN,
      flag: fft.peaks[0] ? `bin ${fmt(fft.resolutionHz, 4)} Hz` : 'no peak above threshold',
    })
  } catch (error) {
    rows.push({ method: 'FFT periodogram', f: NaN, se: NaN, flag: `failed: ${error.message}` })
  }

  // Within-run stability: fit equal segments to see whether "the period" is one number.
  const segments = 4
  const per = Math.floor(n / segments)
  const segF = []
  for (let s = 0; s < segments; s += 1) {
    const sl = { t: t.slice(s * per, (s + 1) * per), x: x.slice(s * per, (s + 1) * per) }
    if (sl.t.length < 40) continue
    try {
      const fit = fitDampedSinusoid(sl.t, sl.x)
      segF.push(fit.reliable ? fit.frequency : NaN)
    } catch {
      segF.push(NaN)
    }
  }
  const validSeg = segF.filter(Number.isFinite)
  if (validSeg.length >= 2) {
    const lo = Math.min(...validSeg)
    const hi = Math.max(...validSeg)
    rows.push({
      method: 'segment fits (4 equal parts)',
      f: Number.NaN,
      se: Number.NaN,
      flag: `${validSeg.length}/4 usable; range ${fmt(lo)}–${fmt(hi)} Hz (${fmt(((hi - lo) / lo) * 100, 1)}% spread)`,
    })
  }

  // A fit can be "reliable" and still be the wrong frequency: confidence is a
  // statement about the fit, not about whether the record contains the
  // phenomenon. Flag estimates outside the physically expected band, and report
  // how many cycles the record covers.
  for (const row of rows) {
    row.cycles = Number.isFinite(row.f) && row.f > 0 ? duration * row.f : NaN
    row.inBand = Number.isFinite(row.f) && row.f >= band[0] && row.f <= band[1]
  }

  return {
    label,
    source: series.source,
    samples: n,
    duration,
    rate,
    periodSeconds: rows.find((r) => r.method.startsWith('damped'))?.f
      ? 1 / rows.find((r) => r.method.startsWith('damped')).f
      : NaN,
    rows,
  }
}

function toMarkdown(r) {
  const lines = []
  lines.push(`### ${r.label}`)
  lines.push('')
  lines.push(`${r.source} · ${r.samples} samples · ${r.duration.toFixed(1)} s · ${r.rate.toFixed(2)} Hz`)
  lines.push('')
  lines.push('| method | f (Hz) | period (s) | cycles | ± | verdict |')
  lines.push('|---|---|---|---|---|---|')
  for (const row of r.rows) {
    const bandNote = Number.isFinite(row.f) && !row.inBand ? ' **outside expected band**' : ''
    lines.push(
      `| ${row.method} | ${fmt(row.f)} | ${Number.isFinite(row.f) && row.f > 0 ? fmt(1 / row.f, 1) : '—'} | ${Number.isFinite(row.cycles) ? fmt(row.cycles, 1) : '—'} | ${Number.isFinite(row.se) ? fmt(row.se, 6) : '—'} | ${row.flag}${bandNote} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

const invokedDirectly = process.argv[1]?.endsWith('fits-report.mjs') ?? false
const opts = args(process.argv.slice(2))
if (invokedDirectly && opts.csv) {
  const band = (opts.band ?? '0.002,0.2').split(',').map(Number)
  const series = loadSeries(readFileSync(opts.csv, 'utf8'))
  process.stdout.write(toMarkdown(report(opts.label ?? opts.csv, series, band)))
} else if (invokedDirectly) {
  process.stderr.write('usage: fits-report.mjs --csv run.csv [--label name] [--band lo,hi]\n')
  process.exit(2)
}
