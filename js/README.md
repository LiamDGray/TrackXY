# Portable numerical core (prototype)

JavaScript implementation of the parts of TrackXY that are pure mathematics: oscillation
estimation, planar calibration, and marker orientation. No dependencies, no build step, Node 22.

```bash
npm test    # 20 tests
npm run bench   # Monte Carlo estimator comparison
```

## Why this exists

Three reasons, in order:

1. **To measure the estimator change before committing to it.** The damped-sinusoid fit in
   `src/estimators.js` is ~2,000× more accurate than the zero-crossing baseline at 20 dB SNR, and
   reports its own uncertainty. Numbers and method: [../docs/design/next-iteration.md](../docs/design/next-iteration.md).
2. **To have a calibration path that handles tilt.** `src/calibration.js` fits a homography, which
   removes the parallax the C++ affine calibration cannot represent (4.1 mm error at 50 mm radius
   under a 25° tilt).
3. **To test whether the browser rewrite is feasible.** These modules are the whole analysis pipeline.
   If TrackXY grows a browser surface, this is what it runs.

## What is here

| Module | Contents |
|---|---|
| `src/estimators.js` | `zeroCrossingEstimate` (parity with C++), `fitDampedSinusoid` (LM fit with covariance and a reliability gate), `phaseDifference` |
| `src/calibration.js` | `fitHomography` (DLT, Hartley-normalised), `applyHomography`, `invertHomography`, `reprojectionError`, `localScale` |
| `src/angle.js` | `principalAngle` (PCA), `unwrapAngles`, `angleFromPair`, `signedAngle`, `angularRate` |
| `bench/estimator_benchmark.mjs` | SNR sweep, 200 trials per point, RMSE/median/p95 and reliability rate |

## Status

**Prototype, not the product.** The C++ implementation remains the reference for the tracker, the
receipt format, and the benchmark. Nothing here touches the video pipeline yet — the tracker
(`calcOpticalFlowPyrLK`) would come from OpenCV.js, and the conformance question between the two
trackers is unresolved. See §5 of the design note for the staged plan.

## Conventions

- Angles in radians; `principalAngle` is ambiguous by π, `signedAngle` is not.
- Frequencies in Hz, damping in s⁻¹, timestamps in seconds (the C++ side uses milliseconds — convert
  at the boundary, not inside the maths).
- Estimators accept `(t: number[], x: number[])` and never mutate their inputs.
