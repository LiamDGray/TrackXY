# Your first measurement

**You will need:** Node.js 22 or newer, and this repository. Nothing else — no camera, no OpenCV, no
build step. This tutorial takes about ten minutes and ends with two analyses of the same synthetic
recording: one that is wrong in a way that looks right, and one that is right.

The point is not the pendulum. The point is learning to read the output before you trust it.

## 1. Generate a recording with a known answer

The tracker writes one CSV row per frame. To learn the analysis without a camera, generate the same
kind of file from a simulated target: a marker tracing a 50 mm circle at 0.8 Hz, filmed by a camera
tilted 25° from square-on.

```bash
cd js
node src/cli.js synthesize --out ../docs/samples/pendulum-tilted.csv --tilt 25 --radius 50
```

```
wrote ../docs/samples/pendulum-tilted.csv (720 rows),
      ../docs/samples/pendulum-tilted.calibration-{affine,homography}.json
truth: frequency 0.8 Hz, amplitude 50 mm, tilt 25°
```

Three files appear. The CSV is shaped exactly like a real run. The two calibration files describe the
same camera in two ways: a single scale about an origin (what the C++ build produces today) and a
four-corner homography.

The 50 mm radius is a fixture size chosen to fit a 640×480 frame, not a measurement of any real
apparatus. If your target is bigger or farther away, [scale it before comparing
numbers](../how-to/calibrate-a-tilted-camera.md#8-scale-the-target-to-your-apparatus).

Write the truth down: **0.8 Hz, 50 mm, circular.**

## 2. Analyse it with the simple calibration

```bash
node src/cli.js analyze \
  --csv ../docs/samples/pendulum-tilted.csv \
  --calib ../docs/samples/pendulum-tilted.calibration-affine.json
```

```
TrackXY analysis
  samples        720 (11.98 s, 16.7 ms apart)
  dropped        1 non-tracking row(s)
  calibration    affine (1.333 px per mm)

  X  f = 0.8000 Hz ± 0.0000   amplitude = 49.954 mm ± 0.067
     damping = -0.0001 /s   offset = -0.011 mm   reliable
  Y  f = 0.8000 Hz ± 0.0000   amplitude = 45.340 mm ± 0.063
     damping = 0.0000 /s   offset = -0.801 mm   reliable

  phase (Y − X)  -89.97° ± 0.11°  — quadrature (circular or elliptical orbit, reversed)

  warnings
   - affine calibration: any camera tilt appears as amplitude error that grows with distance from the origin
```

Read it the way a careful person would:

- Frequency is right to four places.
- Phase is a quarter turn, as a circle should be.
- Amplitude is **49.954 mm on X and 45.340 mm on Y**.

The true target is a circle with equal amplitudes. The instrument has just described an *ellipse*, and
nothing in the numbers announces an error — the only clue is the warning at the bottom, and the only
reason you know to trust it is that you generated the file.

## 3. Analyse the same recording with a homography

```bash
node src/cli.js analyze \
  --csv ../docs/samples/pendulum-tilted.csv \
  --calib ../docs/samples/pendulum-tilted.calibration-homography.json
```

```
TrackXY analysis
  samples        720 (11.98 s, 16.7 ms apart)
  dropped        1 non-tracking row(s)
  calibration    homography (reprojection 0.00 px)

  X  f = 0.8000 Hz ± 0.0000   amplitude = 49.993 mm ± 0.017
     damping = 0.0000 /s   offset = -0.007 mm   reliable
  Y  f = 0.8000 Hz ± 0.0000   amplitude = 49.993 mm ± 0.018
     damping = -0.0000 /s   offset = -0.010 mm   reliable

  phase (Y − X)  -90.00° ± 0.03°  — quadrature (circular or elliptical orbit, reversed)
```

Both axes agree at 49.993 mm, the uncertainties are three times smaller, and the warning is gone.

Nothing else changed. Same CSV, same estimator, same code path. The difference is one calibration
model: a homography can represent a tilted camera, and a scale plus an origin cannot.

## 4. Read the output fields

| Field | Meaning | When to distrust it |
|---|---|---|
| `samples`, duration | How much data the fit saw | Fewer than ~3 periods of oscillation |
| `calibration` | Model used, plus reprojection error for homographies | Reprojection above ~0.5 px |
| `f` ± uncertainty | Oscillation frequency | `UNRELIABLE` flag, or a short record |
| `amplitude` ± uncertainty | Half peak-to-peak, per axis | Unequal axes on a target that should be symmetric |
| `damping` | Exponential decay rate, s⁻¹ | Negative values on a driven system |
| `offset` | Mean position | Large offset means the target is near the frame edge |
| `phase (Y − X)` | Quadrature ⇒ circular; 0°/180° ⇒ linear | Near 90° but with unequal amplitudes — that is geometry, not physics |
| `warnings` | Conditions that make the numbers doubtful | Any warning you cannot explain |

## 5. Break it on purpose

The fastest way to learn what an instrument is telling you is to make it fail.

**Starve the fit.** One second of data is less than one period of a 0.8 Hz oscillation:

```bash
node src/cli.js synthesize --out /tmp/short.csv --radius 50 --seconds 1.2
node src/cli.js analyze --csv /tmp/short.csv --calib /tmp/short.calibration-affine.json
```

```
  X  f = 0.7944 Hz ± 0.0019   amplitude = 48.893 mm ± 0.143
  Y  f = 0.8014 Hz ± 0.0005   amplitude = 41.890 mm ± 0.216
  warnings
   - record covers 0.9 periods; 3 or more is advisable
```

The two axes now disagree about the frequency in the third decimal place, and the uncertainty is two
orders of magnitude larger than in step 2. This is what "not enough data" looks like when the tool is
willing to say it.

**Punch a hole in it.** Edit `docs/samples/pendulum-tilted.csv`, change the `tracking` cell of five
consecutive rows to `lost`, save it as `/tmp/gapped.csv`, and re-run step 3 on it. The frequency is
unchanged to three decimals and a warning appears:

```
  - 1 tracking gap(s), longest 5 frame(s) — the fit assumes even sampling
```

Both experiments tell you the same thing: the instrument's confidence is not a function of how good
the display looks. It is a function of how much data it had and what it noticed about it.

## Where to go next

- **Calibrate a real camera:** [how to calibrate a tilted camera](../how-to/calibrate-a-tilted-camera.md).
- **Understand why the affine model fails:** [the number is not the evidence](../explanation/the-number-is-not-the-evidence.md).
- **Check a number someone sent you:** [measurement provenance](../measurement-provenance.md) and
  `tools/measurement_receipt.py verify`.
- **Change the code:** [architecture](../architecture.md).
