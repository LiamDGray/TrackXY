# TrackXY documentation

Four documents, one per kind of reader.

| Document | Read it if you want | Length |
|---|---|---|
| [Technical report](technical-report.md) | The whole picture: method, what is verified, what is not, and where this could go | ~15 min |
| [Architecture](architecture.md) | To change the code: components, contracts, data flow, test strategy | ~8 min |
| [Measurement provenance](measurement-provenance.md) | To make a result file checkable, or to combine TrackXY with capture attestation | ~8 min |
| [README](../README.md) | To build and run it | ~3 min |

## Reading paths

- **Evaluating the project?** Report §2 (overview) → §4 (verification status) → §7 (where it could
  go). §4 is the honest section; read it before believing any accuracy claim anywhere else.
- **Using it in a lab?** README build and usage → report §3 (method and assumptions) → calibration
  guide in the README. Then decide whether §6 limitations are acceptable for your apparatus.
- **Auditing a result someone gave you?** [Measurement provenance](measurement-provenance.md) →
  `tools/measurement_receipt.py verify`.
- **Teaching with it?** Report §7.2, then the calibration and output sections of the README.

## The one-paragraph version

TrackXY tracks one visual target through a webcam or video file with pyramidal Lucas–Kanade optical
flow, converts pixel coordinates to physical units through an explicit origin and scale, and derives
oscillation frequency, amplitude and inter-axis phase from a moving window. It is designed so that
losing the target stops the measurement rather than silently switching to a different feature, and so
that a result file can be bound to the inputs that produced it. It has not been benchmarked against
known ground truth; see [§4](technical-report.md#4-verification-status).
