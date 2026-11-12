# Next iteration: four proposals, costed

*Design note · 2026-11-12 · companion to the [technical report](../technical-report.md)*

Four changes were proposed for TrackXY: rewrite it in JavaScript, replace the time-series estimator,
account for parallax, and move the marker from the circumference to the axis. This note costs each
one, reports what was measured rather than assumed, and recommends an order.

Everything in §2 and §3 was measured with the prototype in [`js/`](../../js/) — 20 tests, plus a
Monte Carlo benchmark. Reproduce with `cd js && npm test && npm run bench`.

**Summary**

| Proposal | Verdict | Evidence |
|---|---|---|
| Replace the estimator | **Do it.** Largest accuracy gain per hour of work | 2,000× lower frequency error than the baseline at 20 dB SNR (§2) |
| Account for parallax | **Do it, as a homography.** Uniform scale cannot represent tilt | 4.1 mm error at 50 mm radius with a 25° tilt (§3) |
| Marker on the axis | **Do it for rotational apparatus.** Keep the point tracker as the translational path | Direct angle measurement; no foreshortening; stays in frame (§4) |
| Rewrite in JS | **Hybrid, not a rewrite.** JS for the browser/education surface, C++ as the reference | OpenCV.js has `calcOpticalFlowPyrLK`; divergence risk is manageable with golden files (§5) |

## 1. What is actually wrong today

Two of the four proposals address real defects; two are architectural preferences. Naming the defects
first keeps the rest honest:

1. **The estimator is biased.** The zero-crossing method measures the rate at which the *decaying*
   signal crosses its mean, which is not the oscillation frequency. On a damped pendulum the bias is
   systematic, not noise (§2).
2. **The calibration is affine.** A translation and one scale can only represent a camera that is
   square-on to the target plane. Any tilt turns circles into ellipses and introduces parallax that
   grows with distance from the calibration origin (§3).
3. **The tracked feature is a point on a chord.** Rotation is inferred from a projection, and the
   feature has to be re-acquired across the whole arc (§4).
4. **Tracking quality regressed against 2012**, most likely for boring reasons: modern webcams apply
   temporal denoising and auto-exposure that violate brightness constancy, rolling shutters skew fast
   motion, and the current 31×31 window with three pyramid levels is small for larger inter-frame
   displacement. The 2012 version also re-acquired aggressively, whereas the current one stops on
   primary-point loss. See §4.3 for the cheap fixes.

## 2. Estimator: replace zero-crossing with a damped sinusoid fit

**Method.** Fit `x(t) = A·e^(−γt)·cos(2πft + φ) + c` by Levenberg–Marquardt, with analytic Jacobian
and covariance from `σ²(JᵀJ)⁻¹`. Five parameters, all of physical interest: amplitude, damping,
frequency, phase, offset.

**Measured** (200 trials, 8 s at 60 Hz, f = 1.7 Hz, γ = 0.35 /s, added white noise):

| SNR | zero-crossing f RMSE | fit f RMSE | fit f median | fit Δφ median | fit Δφ p95 | fit self-report reliable |
|---|---|---|---|---|---|---|
| 40 dB | 9.0 mHz | 0.06 mHz | 0.04 mHz | 0.04° | 0.12° | 196/200 |
| 30 dB | 135.8 mHz | 0.20 mHz | 0.14 mHz | 0.13° | 0.39° | 198/200 |
| 20 dB | 1219.4 mHz | 0.62 mHz | 0.42 mHz | 0.41° | 1.22° | 196/200 |
| 10 dB | 5197.8 mHz | 1.21 mHz | 1.15 mHz | 1.06° | 2.02° | **7/200** |

Three things to read from this table:

- The accuracy gain is not marginal. At 20 dB — a realistic webcam signal-to-noise ratio for a
  high-contrast marker — the baseline is off by **1.2 Hz**, which is 70% of the signal. The fit is off
  by 0.6 mHz.
- **Phase becomes measurable.** The current implementation estimates phase from crossing timings and
  reports no uncertainty; the fit gives ~0.4° median at 20 dB with a stated error bar.
- **At 10 dB the fit abstains.** After bounding the search (frequency within a factor of four of the
  initial estimate, damping in [−5, 20]), the unconstrained divergence I measured on the first run
  disappeared, but the fit's own reliability test rejects 193 of 200 trials. That is the correct
  behaviour: the instrument says "I cannot measure this", instead of producing 5.2 Hz of noise. Any
  production implementation must keep this gate — the first, unbounded version of this fit returned a
  frequency RMSE of 594 Hz at 10 dB while still claiming convergence.

**Also gained:** damping (log-decrement) as a free output, which the current code cannot produce at
all, and a valid estimate from windows too short for four mean crossings (measured: 0.8 s at 1.7 Hz —
the baseline returns 0, the fit recovers 1.7 Hz).

**Cost.** ~200 lines of numerics; the JS prototype is complete and tested. Porting to C++ is a
translation, not a redesign. Keep zero-crossing as the streaming display path until the fit window
fills, then switch.

## 3. Parallax: replace the affine calibration with a homography

**Where the error comes from.** With a camera tilted θ from the target plane's normal, a marker at
radius *r* from the calibration origin appears displaced by approximately `r·(1 − cos θ)` in-plane plus
a projective term that a uniform scale cannot remove. The error is zero at the origin and grows with
distance.

**Measured** (focal 800 px, camera 600 mm away, 25° tilt, calibration from a 120 mm square):

| Radius | Error using uniform scale + origin | Error using a homography |
|---|---|---|
| 10 mm | 0.55 mm | < 1e-9 mm |
| 25 mm | 1.63 mm | < 1e-9 mm |
| 50 mm | 4.06 mm | < 1e-9 mm |
| 80 mm | 7.97 mm | < 1e-9 mm |

4 mm at 50 mm is 4.6° of angular error — larger than the amplitude of a small torsion oscillation.
This is the single largest accuracy defect in the current system, and it is invisible to the user
because the numbers look smooth.

**Closed loop confirms it, and names the direction.** Simulating a 50 mm circular target at 0.8 Hz,
25° tilt, 0.2 px tracking noise, and running the full analysis (`js/bench/accuracy.mjs`):

| Model | X amplitude | Y amplitude | Frequency error |
|---|---|---|---|
| Uniform scale | 49.954 mm (−0.1%) | **45.340 mm (−9.3%)** | 0.00 mHz |
| Homography | 49.993 mm (−0.01%) | 49.993 mm (−0.01%) | 0.01 mHz |

The tilt compresses the axis along the tilt direction by `cos 25° = 0.906`, and the damage is confined
to amplitude: **frequency is untouched**, because a linear distortion cannot change a rate. That is why
the defect survived unnoticed — the number the experiment was designed to measure was correct. The
instrument goes further and reports `phase = −89.97°`, i.e. "quadrature, elliptical orbit", which is a
coherent physical description of an artefact.

**Fix.** Four or more coplanar correspondences (printed square, chessboard corners, or ArUco corners)
give a 3×3 homography by DLT. Implemented in [`js/src/calibration.js`](../../js/src/calibration.js)
with Hartley normalisation; exact for four points, least-squares beyond.

**Two things a homography does not fix, and one it makes worse:**

1. **Marker height.** If the marker sits *h* above the calibrated plane, the camera sees it displaced
   by ≈ `h·tan θ`. At 25° and h = 20 mm that is **9 mm** — larger than the tilt error it replaces. The
   calibration plane must be the marker plane, not the table. This is not a software fix; it is a
   calibration-target instruction that the software must state.
2. **Lens distortion.** A wide webcam at close range has barrel distortion of several pixels at the
   frame edge, which no homography removes. Either calibrate `cv::calibrateCamera` once per camera and
   undistort before tracking, or restrict the measurement to the central third of the frame and say so.
3. **It makes the current workflow stricter.** The operator must place a target rather than answer
   "how far is 100 pixels?". That is a real cost in the lab and a UX design problem: four corner
   clicks on a live preview, with the reprojection error displayed so the user knows the calibration
   is good.

## 4. Marker on the axis, viewed from above

This is the strongest idea in the list, and it changes what the instrument measures.

**The original apparatus was a side view, and that is a distinct geometry.** A pointer on a strip
around the dome's circumference, filmed from about two feet away, gives `x(t) = r·sin θ(t)` — a chord,
not an arc. Measured against simulated truth (`js/bench/cylinder.mjs`, r = 152.5 mm, camera 610 mm):

| True amplitude | `asin(x/r)` | Chord ÷ radius |
|---|---|---|
| 20° | −1.2% | −3.0% |
| 30° | −2.7% | −7.3% |
| 45° | −6.2% | −15.9% |
| 60° | −11.8% | −26.3% |

Frequency is unaffected at every amplitude (< 0.1 mHz), which is why the error survived: the period —
the quantity the experiment existed to measure — was always right. The pipeline now accepts
`radiusMm` and reports `rotation.amplitudeDeg`, with a warning above 30°.

Note also that the white paper strip in the original rig was doing real work: it removes the dome's
periodic mesh texture across the tracking band, which is exactly the failure mode that makes corner
detection hop between identical features. Any redesign must keep an equivalent contrast band.

**Why the circumference marker is still weak.** Three losses remain: the amplitude must be divided by
a separately known radius to recover angle; the feature moves through the frame and is foreshortened
at the ends of the arc (apparent speed falls to 50% at 60° and 26% at 75°); and any wobble of the
rotation axis is indistinguishable from rotation.

**Why the axis marker is better.** Viewed from above, a marker on the rotating body rotates *in place*:

- **θ is measured, not inferred.** No radius term, no projection inversion, no foreshortening.
- **The feature never leaves the frame.** The tracker sees the same pixels throughout, so brightness
  constancy holds and motion is small — exactly the regime where Lucas–Kanade is reliable.
- **Rotation separates from translation.** A planar fiducial (ArUco/AprilTag) gives full pose; the
  in-plane angle is the rotation, and any out-of-plane component is wobble, measurable rather than
  confounded.
- **Non-uniform rotation becomes visible.** Stick-slip, friction and damping are θ̈ features; the
  chord projection smears them.

**The precision argument, honestly.** If centroid noise is σ pixels and the marker is at radius *r*
with pixel scale *k*, angular resolution is `dθ ≈ σ/(r·k)` — so a *larger* radius is better, and a
marker at the exact axis has no lever arm. Motion blur, however, contributes angular error
`≈ ω·T_exp` regardless of radius. The axis marker wins on robustness (constant position, no
foreshortening, direct angle), not on raw angular resolution; put the fiducial at 50–70% of the body's
radius, not at the centre point.

**Requirements it imposes.**

- Direction ambiguity of π for a symmetric marker. A radial stripe gives θ mod π; an asymmetric
  fiducial gives signed θ. If the measurement is an oscillation about a rest angle, mod π is enough —
  but it must be documented, because a full rotation will alias.
- The camera must be roughly normal to the rotating plane. A homography (§3) handles modest tilt.
- The physical marker must be flat and matte; a glossy sticker under a ring light produces specular
  highlights that rotate with the light source, not the body.

**Migration.** Keep both paths, selected by configuration: `MODEL_POINT` (current) and `MODEL_AXIS`
(fiducial angle). Same analyser, different observable — the estimator in §2 takes `(t, value)` and does
not care whether the value is millimetres or radians.

### 4.3 The tracking regression against 2012

Cheap fixes, in order of expected effect, all independent of the marker change:

1. **Lock the camera.** Disable auto-exposure, auto-white-balance and temporal denoise where the
   platform allows it (browser: `MediaTrackConstraints` `exposureMode`/`whiteBalanceMode: 'manual'`;
   native: V4L2 controls). Brightness constancy is a *precondition* of Lucas–Kanade, and 3DNR actively
   violates it.
2. **Raise the frame rate** to 60 or 120 fps. Smaller inter-frame displacement, less blur, and rolling
   shutter skew scales with exposure time.
3. **Predict before you track.** Seed `calcOpticalFlowPyrLK` with a constant-velocity prediction from
   the previous two frames instead of the last position; this is what makes fast arcs survivable.
4. **Fiducial detection instead of corner tracking**, which re-detects globally every frame and cannot
   drift.
5. **Re-acquire rather than abort.** Keep the current "stop on primary loss" as the default, but add an
   explicit, logged re-acquisition mode so the operator can see the difference between a lost frame and
   a lost experiment.

## 5. Rewrite in JavaScript?

**What the rewrite would buy.** A zero-install browser demo — open a URL, pick a video, watch the
tracker and the estimates — is worth more for adoption and teaching than any amount of native polish.
Schools run Chromebooks; hiring managers will not clone a CMake project. OpenCV.js exposes
`calcOpticalFlowPyrLK`, `goodFeaturesToTrack` and `cornerSubPix`, so the tracker itself ports without
algorithmic change. The numerical core (estimators, calibration, angle) is already written and tested
in JS — see `js/` — and it is a few hundred lines.

**What it would cost.** A ~7–9 MB wasm payload, a slower tracker, camera-control differences between
browsers, and — the real risk — **two implementations drifting apart**. A rewritten tracker that is
subtly different from the native one invalidates the receipt chain and undermines the point of the
provenance work.

**Recommendation: hybrid, staged.**

1. **Now:** the JS numerical core is the reference for *analysis* (it is tested against synthetic truth,
   which the C++ analyser is not) and it already ships a CLI: `js/src/cli.js analyze` takes a CSV and a
   calibration, and `synthesize` produces known-answer input. A browser app would consume the same
   modules; the analysis half of the rewrite is done and tested.
2. **Next:** add the browser tracker behind a flag, and a **conformance suite**: three short clips,
   processed by both implementations, compared row-by-row within a stated tolerance. Divergence becomes
   a test failure rather than a surprise.
3. **Only then:** decide whether the native path earns its maintenance. If the browser tracker matches
   within tolerance, the C++ implementation becomes the reference implementation for the receipt
   format and the benchmark, not the primary product.

The decision to *not* rewrite wholesale is a decision about risk, not about JavaScript.

## 6. Sequence

| Phase | Work | Why first | Effort |
|---|---|---|---|
| 1 | Homography calibration + distortion decision | Largest accuracy defect; independent of everything else | 1 week |
| 2 | Damped-sinusoid estimator with reliability gate, ported to C++ | Largest accuracy gain; enables damping output | 1 week |
| 3 | Synthetic benchmark: rendered marker, known trajectory, published error table | Makes every claim above checkable by a stranger | 1 week |
| 4 | Axis/fiducial mode (`MODEL_AXIS`) | Changes the observable; needed for rotational apparatus | 2 weeks |
| 5 | Camera locking + 60 fps + predicted seeding | Recovers the 2012 tracking quality | days |
| 6 | Browser app on the JS core; conformance suite against native | Adoption, teaching, demo | 2–3 weeks |
| 7 | Row→frame binding in the receipt | Closes the provenance gap | 1 week |

Phases 1–3 are the credibility package: after them, the instrument has a stated accuracy, a stated
calibration procedure, and a benchmark anyone can run. Phases 4–5 make it *better*. Phase 6 makes it
*seen*.

## 7. What would change this plan

- If the apparatus is only ever a planar pendulum (translation, not rotation), §4 is unnecessary and
  §1–§3 plus §5–§7 are the whole story.
- If browser performance on 1080p proves inadequate (likely above ~720p), the browser app becomes an
  analysis-and-visualisation tool rather than a live tracker, which is still the adoption win.
- If the measurement is used for anything adversarial, §7 (row→frame binding) moves to phase 1,
  because a receipt that covers a whole file is weaker than one that covers the frames a row came from.
