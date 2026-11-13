# Bounding the error in a slow torsion balance

**Use this when** a torsion balance with a period of tens of seconds is being used to measure small
rotational drifts, and the result has to survive a reader who asks "how do you know?"

**You will need:** the assembled rig, a way to measure the filament's torsion constant on that
assembly, and the discipline to run the same analysis on every record.

A torsion balance is a sensitive instrument that produces a number very easily and a defensible number
only if four things are true: the geometry is calibrated, the torsion constant is measured rather than
inherited, the record is long enough for the resolution being claimed, and the suspension has not moved
between runs. This guide turns each of those into a number, so the uncertainty budget can be written
before the claim is made rather than after it is questioned.

## 1. Write the budget before the run

A claim of the form *"the period changed by 2% between runs"* needs three quantities: the resolution of
one period estimate, the reproducibility of the assembly between runs, and the size of the effect. If
the second is larger than the third, the claim is not about the apparatus — it is about the filament,
the room, or the operator's hands. Compute all three first. The rest of this guide supplies them.

## 2. Sources of error, and how to bound each

### 2.1 Projection: chord versus arc

A marker on the circumference of a rotating body travels on a cylinder. Its horizontal image position
is a chord:

```
x = r · sin θ
```

Treating the calibrated millimetres as an arc length under-reports the angle by `sin θ / θ`:

| Amplitude | Error if the chord is read as an arc | Error after `asin(x/r)` |
|---|---|---|
| 10° | 0.5% | 0.4% |
| 20° | 2.0% | 1.3% |
| 30° | 4.5% | 3.0% |
| 45° | 10.0% | 7.1% |
| 60° | 17.3% | 13.2% |
| 75° | 26.2% | 21.8% |

**Bound it:** apply `asin(x/r)` up to 30° and state the residual. Above 30° the perspective term is
several percent and the honest move is to change the geometry — a marker on the rotation axis, viewed
from above, measures the angle directly.

**Measure `r` to the marker path**, not to the outside of the object: the distance from the axis to the
centreline of the tracking band. A 2 mm error in a 175 mm radius is a 1.1% error in every angle, which
is the same size as the corrections above.

### 2.2 Camera tilt and calibration model

A single scale plus an origin cannot represent a camera that is not square-on to the measurement plane.
At 25° of tilt, one axis of the image is compressed by `cos 25° = 0.906`, and amplitudes on that axis
read 9.4% low. A four-corner homography removes this entirely.

**Bound it:** fit a homography and report its reprojection error. Under 0.5 px is good; above 2 px, the
calibration is wrong and the numbers with it. Note that the homography corrects the *calibration plane*
only: a marker standing above that plane is displaced by roughly `h · tan θ` — 9 mm for a marker 20 mm
above the plane at 25° of tilt, which is larger than the tilt error just removed.

### 2.3 Lens distortion

A wide lens at close range bends straight lines near the frame edge by several pixels, and no
homography unbends them.

**Bound it:** either calibrate the camera once and undistort, or restrict measurement to the central
third of the frame and say so. Keep the tracked motion inside roughly 60% of the frame's short side;
this also leaves room for the target to leave and return.

### 2.4 Torsion constant

For a torsion pendulum, `T = 2π√(I/κ)`, so the period measures stiffness, not mass. Two consequences
follow.

**Do not inherit κ.** Published values belong to the published assembly. Substituting a lighter dome
and a longer filament changes κ and therefore the force-per-degree figure:

```
κ_assembly = 4π²I / T²            with I ≈ ⅔mr² for a thin hemispherical shell
```

For a 0.18 kg, 175 mm-radius shell at T = 30 s, κ ≈ 1.6 × 10⁻⁴ N·m/rad. Against a published
2.24 × 10⁻⁴ for a heavier dome on a shorter filament, that is a force scale of roughly 3.3–3.6 mg per
degree rather than the published 4.6.

**Bound it:** measure κ on the assembly — add known masses at a known radius and fit `ω²` against the
added moment of inertia — and report the fit's uncertainty. This is the single largest lever on every
force figure derived from the data.

**Then bound the filament.** κ scales as `1/L`, so the period scales as `√L`:

| Filament length error | Frequency error |
|---|---|
| ±0.5 mm on 22.5 mm | ±1.1% |
| ±1 mm | ±2.2% |
| ±2 mm | ±4.4% |

A 2% change in period is therefore within one millimetre of filament length, and a 4% change in κ. If a
period change is attributed to inertia instead, it corresponds to 4% of the bob's mass — 7.2 g on a
180 g dome, which any kitchen scale would show.

**And bound the filament's material behaviour.** Nylon is hygroscopic and viscoelastic: moisture uptake
changes the shear modulus, and a knotted filament creeps under load. Both produce slow, monotone period
drifts of order a percent. Log temperature and relative humidity with every run; re-tie the filament as
little as possible; note when you do.

### 2.5 Record length and resolution

A discrete transform of a record of length `T` resolves `1/T` in frequency. For a period near 30 s
(f ≈ 0.03 Hz), that is:

| Record | Resolution | As a fraction of f |
|---|---|---|
| 6 min (380 s) | 2.6 mHz | 9% |
| 10 min | 1.7 mHz | 6% |
| 28 min (1700 s) | 0.59 mHz | 2% |

A difference smaller than one bin cannot be read from a peak position; interpolation narrows the
statistical uncertainty but does not create resolution. **Bound it:** state the record length and the
resolution, and never compare a difference smaller than the resolution without an estimator that
reports its own uncertainty.

Sampling rate sets the other edge. The published protocol samples at 10 Hz; other builds sample at
30 Hz or more. Either is fine for a 30 s period, and neither resolves anything above its own Nyquist
limit — but the two are not interchangeable when comparing peak heights.

### 2.6 The estimator

Time-domain and frequency-domain estimators fail differently on a damped signal, and the failure is
silent:

| Estimator | Behaviour on a decaying 30 s oscillation |
|---|---|
| Mean-crossing (average half-period) | Biased by the envelope; counts noise crossings once the amplitude decays |
| Damped-sinusoid fit, seeded by crossings | Latches onto high-frequency noise if the record is long and the tail is noise |
| Damped-sinusoid fit, **seeded spectrally** | Recovers the frequency with an honest uncertainty |
| Lomb–Scargle | Correct on unevenly sampled records; needs several cycles to be trusted |
| FFT | Correct, resolution-limited |

**Bound it:** use a spectral peak as the initial value for a time-domain fit, report the fit's standard
error, and report how many cycles the record contains. Treat the fit's own "reliable" flag as a
statement about the fit, not about the world: a fit can be confident and still be measuring the wrong
feature. Reject anything with fewer than about three cycles, and anything outside the physically
plausible band.

### 2.7 Drift inside the run

A slow drift of the centre of oscillation inflates peak-to-peak amplitude and dominates the low
frequency bins of any spectrum. The same record therefore yields different answers depending on
whether the drift was removed.

**Bound it:** track the centre as a moving median, report its excursion, subtract a fitted drift before
measuring amplitude and spectra, and report the drift's time constant with its goodness of fit. Treat
the onset of a drift as a matter for the event log, not for the analysis: an exponential fitted from a
later start still fits, with the same time constant, so the onset is not identifiable from the shape
alone.

### 2.8 Environment

Convection, thermal gradients, acoustic noise, foot traffic and door closures all couple to a
suspended mass. So does room occupancy, which changes the temperature field and the air movement.

**Bound it:** record room temperature and humidity, whether HVAC and windows were closed, whether the
apparatus was enclosed, and whether the room was occupied — as a condition, with no interpretation
attached. Run a thermal control (a source at comparable surface temperature, in place of whatever
else is in the room) and report it as a thermal control. Run the rig for the same duration with
nothing changed, to establish the baseline drift.

## 3. A worked budget

A representative assembly: 175 mm radius, 0.18 kg dome, 22.5 mm filament, 10° amplitude, 1700 s
record, 10 Hz sampling, homography calibration with 0.3 px reprojection error.

| Term | Magnitude (k = 1) | How obtained |
|---|---|---|
| Marker radius | 1.1% | ±2 mm on 175 mm, measured to the band |
| Projection residual | 1.3% | `asin` inversion at 10° amplitude |
| Calibration | 0.4% | 0.3 px reprojection over the calibrated square |
| Torsion constant | 3% | measured on the assembly; the dominant term |
| Filament length (between runs) | 2.2% | ±1 mm, if re-tied |
| Record resolution | 2% | 1/1700 s against 0.03 Hz |
| Estimator standard error | 0.1% | fit's own covariance, clean record |

Within one run, the combined uncertainty on an angle is of order 2%, dominated by radius and
projection. **Between runs**, the dominant term is the filament, at 2.2% per millimetre — which is why
a between-run comparison needs the assembly untouched, or a measured filament length in the metadata.

A defensible statement looks like this:

> Period 34.5 s, from a 1700 s record at 10 Hz (resolution 0.6 mHz, 50 cycles). Fit standard error
> 0.3 mHz. κ measured on the assembly, 3% (k = 1). Filament length 22.5 ± 0.5 mm, unchanged between
> the three runs. Room 21.4–21.9 °C, 38–41% RH, HVAC off, unoccupied except the operator.

An indefensible one looks like this:

> The period changed from 34.5 s to 33.7 s.

The second is not wrong because of the numbers. It is unfalsifiable: no record length, no resolution,
no statement about the assembly, no uncertainty — so a reader cannot tell whether the difference is the
apparatus, the filament, the room, or an artefact of two different analyses.

## 4. Controls worth running

1. **Repeat runs, assembly untouched.** Three runs, same filament, same knot, no re-hanging, hours
   apart. This measures the artefact before any condition changes.
2. **A deliberate filament change.** Shorten by 1 mm, re-hang, measure. If the period moves by the same
   amount as the claimed effect, the effect is the filament.
3. **Thermal control.** A source at comparable surface temperature, placed where the other condition
   would be. Run it for the same duration.
4. **Blinded analysis.** The analyst should not know which record is which until the estimates are
   fixed. An event log with timestamps makes this possible; expectation does not.
5. **Same analysis everywhere.** Same record length, same estimator, same frequency band, same
   detrending, for every record in the comparison.

## 5. Records

Every run should leave behind: the raw sample file, the calibration used, the event log (condition
start and end, room state, filament length), the analysis parameters, and a receipt binding the result
to the file it came from. The receipt matters more than it looks: a hash proves the file has not
changed, and a recorded parameter set makes the result reproducible rather than merely available.

## 6. The point

An uncertainty budget is not paperwork added after the result. It is the thing that decides which
results are worth reporting — and, in a slow oscillator, it usually decides that the interesting
quantity is the *reproducibility of the suspension*, not the phenomenon. Writing that down first is
what separates an instrument from a demonstration.

## Related

- [Instrument a torsion balance](instrument-a-torsion-balance.md) — the protocol, its parameters, and
  what the software cannot establish.
- [Measure rotation from a side view](measure-rotation-from-a-side-view.md) — the chord correction in
  detail.
- [Calibrate a tilted camera](calibrate-a-tilted-camera.md) — the homography procedure.
