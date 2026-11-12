# Instrumenting a torsion-balance protocol

*What this software has to measure when the experiment is a suspended mesh hemisphere, a very slow
oscillation, and a period of thirty seconds.*

The apparatus this project was built around is not a generic pendulum demonstration. It is a
replication rig for a published torsion-balance protocol — a steel-mesh hemisphere suspended by a
short filament, filmed side-on, with an object under test beneath it — and the quantities that protocol
reports are not the ones a single damped-sinusoid fit produces. This document records the protocol's
parameters, what the tool computes for each reported quantity, and the limits of what any of it can
establish.

It describes instrumentation. It does not evaluate the protocol's conclusions, and nothing here should
be read as an endorsement of them. The source paper and the parts list are not redistributed with this
repository — they are third-party documents — so the parameters below are recorded here instead.

## The apparatus as published

| Item | Value | Source |
|---|---|---|
| Collector | 15 × 35 cm steel-mesh hemisphere | Figure 2 |
| Target | 1 cm white dot on the hemisphere | Figure 2 |
| Suspension | 1.7 cm nylon monofilament (33 cm, 0.32 mm copper wire in the grounded variant) | text |
| Camera | ProScope HR2, 1–10× lens, side-on | Figure 1 |
| Sampling | 10 measurements per second | text |
| Natural period | 29.4 s (0.034 Hz); best-fit ω = 0.224 rad/s | Figure 3 |
| Damping | γ = 0.009 /s (highly damped; τ_decay ≈ 111 s) | Figure 3 |
| Torsion constant | 2,240 dyne·cm/rad = 39 dyne·cm/deg | Figure 3 |
| Scale | 1° of rotation ≈ 0.3 cm of displacement | text |
| Force scale | 1° ≈ 4.6 mg equivalent | text |
| Run structure | ~6 min free oscillation to establish baseline, then ~28 min test segments, then ~43 min after the condition ends | text, Figures 4–5 |

My rig kept the layout and replaced the capture and analysis software. The target was inverted — a
black map-pin pointer on a white paper strip taped around the circumference, rather than a white dot on
bare mesh. That inversion is worth noting: the strip removes the mesh's periodic texture across the
tracking band, which otherwise defeats corner detection.

### The dome is not the same, and that changes the force scale

The published rig used a black 220 g food cover with a 1.7 cm filament. Mine is the Camping World
replacement: red, 180 g, 14 in diameter × 6 in high, Intersource part D14-983, with a filament of
2–2.5 cm chosen to restore a 30–40 s period.

That substitution is legitimate for the motion measurements and **invalid for the published force
calibration**. Torsion constant scales with `1/L` for the filament and the force scale scales with κ, so
a longer filament and a lighter dome give a different mg-per-degree figure:

- κ scales as `1/L`: 2.25 cm instead of 1.7 cm is about 24% lower.
- The published 4.6 mg/deg therefore does not transfer. From `κ = 4π²I/T²` with a thin hemispherical
  shell (`I ≈ ⅔mr²`, 0.18 kg, r = 0.175 m) and T = 30 s, κ ≈ 1.6 × 10⁻³ N·m/rad against the
  published 2.24 × 10⁻³, and the force scale falls to roughly 3.3–3.6 mg/deg.
- The published figure appears to apply the equivalent force at the hemisphere's centre of mass
  (`r/2` = 8.75 cm), which reproduces their numbers to within a millimetre of lever arm. Apply yours at
  the same point or the comparison is meaningless.

Measure κ on the actual assembly — add known masses to the rim and fit ω against the added moment of
inertia, as the source paper does — rather than scaling the published value. The displacement
conversion (1° ≈ 0.305 cm at r = 175 mm) is geometric and does transfer.

## The four reported quantities

The protocol does not ask "what is the frequency". It asks four questions, and each needs different
machinery.

**1. Where is the centre of oscillation, and how far did it move?**
This is the headline measurement — shifts up to 2.2 cm, reported as 7.3° and 34 mg of equivalent
force. A global sinusoid fit reports one offset for the whole run and cannot see a shift. The tool
tracks the centre as a moving median and reports the maximum excursion:

```bash
cd js
node src/cli.js balance --csv run.csv --window 120
```

```
  centre shift   2.14 cm = 7.1° = 33 mg equivalent
```

The unit conversions are inputs, not assumptions: `--cm-per-deg 0.3 --mg-per-deg 4.6` reproduce the
published calibration. They are also the two numbers most worth re-measuring on your own rig, because
every force figure derives from them.

**2. How large are the oscillations?**
Peak-to-peak and half-peak-to-peak, computed on the *detrended* signal. Measuring amplitude without
removing the drift inflates it — a falling centre looks like a bigger swing — which is one of the
easier ways to manufacture an effect.

**3. Which frequencies are present?**
The claim under test is that new frequencies appear, so a single fit is the wrong instrument. The tool
computes a Hann-windowed periodogram, polynomial-detrended, and reports peaks:

```
  spectrum
   - 0.0338 Hz  (70% of strongest)
   - 0.0117 Hz  (16% of strongest)
   - 0.0107 Hz  (14% of strongest)
```

Two cautions belong in the report itself, and are here instead because they are about interpretation.
Spectral power is normalised **within the reported band** (default ≥ 0.004 Hz), because a slow drift
carries more energy at 0 Hz than any oscillation carries at its own peak; normalising across the whole
spectrum makes every real peak look negligible. And the drift is not band-limited: a relaxation with
τ in the hundreds of seconds and a tone at 0.011 Hz (91 s period) overlap in frequency, so both share
the lowest bins. That is an identifiability problem, not a bug, and it is why the drift is removed
with a fitted model before the spectrum is computed.

**4. How fast did the centre move?**
Reported as a relaxation constant τ — the time to cover 1/e of the shift — which is how the protocol
characterises the time course:

```
  relaxation     τ = 336 s from onset ≈ 333 s, R² = 0.997
```

The fit uses the log-linear form: `−ln(1 − p)` against time, where `p` is the fraction of the way from
baseline to asymptote. That is stable where a blind two-parameter search over onset and τ is not —
the blind search happily trades a late onset for a long time constant.

**The onset is only partly identifiable.** An exponential fitted from a later start still fits, with
the same τ, because the starting value is free. The tool estimates onset from the first window that
moves 10% of the total shift, which is a convention, not a measurement. If onset matters to the
argument, log the event — when the condition began and when it ended — rather than inferring it.

## What the software cannot establish

- **Cause.** It measures the motion of a suspended mass. A force, a draught, a temperature gradient,
  a floor vibration, or a change in the room's air density all produce motion. Attributing the motion
  to a specific mechanism is outside the instrument's competence, and the protocol's own controls —
  grounding the collector and the object under test, ruling out air currents — are the reason to trust any
  of it.
- **Blinding.** A run in which the operator knows when the condition began is not blinded. The
  software can timestamp the event and compute from a fixed script; it cannot remove the operator's
  expectation from the analysis.
- **A stable baseline.** A single run cannot distinguish a slow drift caused by the condition under
  test from one caused by the room warming up over half an hour. Baseline stability is an experimental-design
  question, and it needs repeat runs of equal length with nothing under the pendulum.
- **Anything about the hypothesis under test.** See above.

## Reproducibility

Recordings from this protocol are long (tens of minutes), sampled slowly, and analysed by a script
whose parameters matter. Attach a receipt to the result file:

```bash
tools/measurement_receipt.py emit --csv run.csv --calibration calibration.yml --out run.receipt.json
```

The receipt records the analysis parameters and a hash chain over the rows, so a reader can tell
whether the numbers came from the file they were given — and, for a claim this contested, whether the
file they were given is the one that was analysed.

## Related

- [The number is not the evidence](../explanation/the-number-is-not-the-evidence.md) — why the
  geometry and the estimator can be wrong without looking wrong.
- [Measure rotation from a side view](measure-rotation-from-a-side-view.md) — the chord-to-angle
  correction this rig needs.
- [Measurement provenance](../measurement-provenance.md) — what a receipt does and does not prove.
