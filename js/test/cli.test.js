import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url))

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    check: false,
  })
}

test('synthesize writes a CSV and two calibrations, and analyze reads them back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trackxy-cli-'))
  try {
    const csv = join(dir, 'pendulum.csv')
    const emitted = run(['synthesize', '--out', csv, '--tilt', '25', '--radius', '50'])
    assert.equal(emitted.status, 0, emitted.stderr)

    const rows = readFileSync(csv, 'utf8').trim().split('\n')
    assert.ok(rows.length > 100, `rows ${rows.length}`)

    const affine = join(dir, 'pendulum.calibration-affine.json')
    const homography = join(dir, 'pendulum.calibration-homography.json')
    assert.ok(readFileSync(affine, 'utf8').includes('affine'))
    assert.ok(readFileSync(homography, 'utf8').includes('homography'))

    const analyzed = run(['analyze', '--csv', csv, '--calib', homography, '--json'])
    assert.equal(analyzed.status, 0, analyzed.stderr)
    const result = JSON.parse(analyzed.stdout)
    assert.ok(Math.abs(result.axes.x.frequency - 0.8) < 0.01, `f ${result.axes.x.frequency}`)
    assert.equal(result.calibration.model, 'homography')
    assert.ok(result.calibration.reprojectionPx < 0.05)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('analyze prints a human report by default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trackxy-cli-'))
  try {
    const csv = join(dir, 'run.csv')
    run(['synthesize', '--out', csv, '--tilt', '0'])
    const analyzed = run(['analyze', '--csv', csv])
    assert.equal(analyzed.status, 0, analyzed.stderr)
    assert.match(analyzed.stdout, /TrackXY analysis/)
    assert.match(analyzed.stdout, /phase \(Y − X\)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('unknown command and missing arguments exit non-zero with a message', () => {
  const unknown = run(['frobnicate'])
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /unknown command/)

  const missing = run(['analyze'])
  assert.equal(missing.status, 2)
  assert.match(missing.stderr, /--csv/)
})
