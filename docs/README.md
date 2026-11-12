# TrackXY documentation

Organised by what you are trying to do, in the four modes that documentation usually fails to
separate: learning, doing, looking up, and understanding. If you only read one thing, read the
[explanation](explanation/the-number-is-not-the-evidence.md) — it is the argument for everything else.

## Learning: take it for a spin

**[Your first measurement](tutorials/first-measurement.md)** — ten minutes, no camera, no build step.
Generate a synthetic recording with a known answer, analyse it twice, and watch a calibration model
turn a circle into an ellipse and back.

## Doing: a specific job

**[Calibrate a tilted camera](how-to/calibrate-a-tilted-camera.md)** — when the camera cannot be made
square-on to the target plane and the numbers still have to be in millimetres. Includes the
troubleshooting table that would have saved me a 9% error.

Also useful on the job: `tools/measurement_receipt.py` to bind a result to its inputs
([provenance](measurement-provenance.md)), and `js/src/cli.js` to analyse a CSV without a camera.

## Looking up: contracts and schemas

**[Architecture](architecture.md)** — components, guarantees, frame lifecycle, CSV schema, test
strategy, extension points. Read this before changing the code.

## Understanding: why it is like this

**[The number is not the evidence](explanation/the-number-is-not-the-evidence.md)** — three defects
that produced plausible wrong answers, the measurements that exposed them, and the case for
documentation that says what an instrument cannot do.

**[Technical report](technical-report.md)** — the formal account: method, assumptions, verification
status (including what is *not* verified), limitations, and three directions for the project.

**[Next iteration](design/next-iteration.md)** — measured trade-offs for replacing the estimator,
changing the calibration geometry, moving the marker to the rotation axis, and rewriting in
JavaScript.

**[Measurement provenance](measurement-provenance.md)** — threat model, receipt schema, and how
receipts compose with [RealPeep](https://github.com/LiamDGray/realpeep) capture attestation.

## Reference material

| Path | Contents |
|---|---|
| [`README.md`](../README.md) | Build, run, keyboard controls, calibration guide |
| [`js/`](../js/) | Portable numerical core: estimators, calibration, angle, CLI, benchmarks |
| [`docs/samples/`](samples/) | A synthetic recording and its two calibrations |
| [`tools/measurement_receipt.py`](../tools/measurement_receipt.py) | Emit and verify measurement receipts |
