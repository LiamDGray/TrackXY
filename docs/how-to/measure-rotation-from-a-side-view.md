# How to measure rotation from a side view

**Use this when** the marker travels around a circumference — a dome, a disc, a wheel, a strip taped
around a cylinder — and the camera looks at that circumference side-on.

The horizontal image position of such a marker is a **chord**, `x = r·sin θ`, not the distance it has
travelled. Treating the millimetres as an arc under-reports the angle by `sin θ / θ`: 2% at 20°, 10% at
45°, 26% at 75°. This procedure recovers the angle and tells you when to stop trusting it.

**You will need:** the radius to the marker's path (not to the outside of the object), a scale
calibration, and a recording.

## 1. Measure the radius to the marker, not to the object

The formula uses the radius of the circle **the pointer actually travels on**. For a strip taped around
a dome, that is the distance from the rotation axis to the strip's centreline, which is smaller than the
dome's outer radius by the shell thickness plus half the strip width.

For the 35 cm hemisphere of the published apparatus, the pointer runs at about 175 mm — confirmed by
its own calibration, since 1° at 175 mm is 3.05 mm, the stated 0.3 cm.

Measure it to the nearest millimetre. A 2 mm error in a 175 mm radius is a 1.1% error in every angle,
which is comparable to the corrections you are making.

If the dome is not circular — a frustum, an ellipse — there is no single radius, and this method does
not apply. Use the top-down fiducial instead (see §5).

## 2. Calibrate the near-side plane

The pointer moves in a plane roughly tangent to the cylinder at the front. Calibrate that plane:
either a uniform scale measured there, or a four-corner homography if the camera is not square-on
([procedure](calibrate-a-tilted-camera.md)).

A homography corrects camera tilt; it cannot correct the cylinder. Both are in play, and the `asin`
inversion below handles only the second.

## 3. Analyse with the radius

```bash
cd js
node src/cli.js analyze --csv run.csv --calib camera.calibration.json --radius 175
```

```
TrackXY analysis
  samples        720 (11.98 s, 16.7 ms apart)
  dropped        1 non-tracking row(s)
  calibration    affine (1.333 px per mm)

  X  f = 0.8000 Hz ± 0.0000   amplitude = 100.5 mm ± 0.3
     damping = 0.0104 /s   offset = -0.2 mm   reliable
  ...

  rotation       41.8° ± 0.2° at 175 mm radius
     chord 100.5 mm; small-angle shortcut would say 37.5°
```

Read the `rotation` line, not the `X amplitude` line. The amplitude in millimetres is a chord measured
along one axis; the rotation line is the angle you actually wanted.

## 4. Know where the inversion stops working

`θ = asin(x/r)` assumes the marker stays at a constant distance from the camera. It does not: the front
of the cylinder is `r` closer than the sides, and the resulting perspective residual grows with
amplitude. Measured against simulated truth (`npm run bench:cylinder`):

| True amplitude | `asin` inversion | Naive chord ÷ radius |
|---|---|---|
| 10° | −0.4% | 0.0% |
| 20° | −1.3% | −3.2% |
| 30° | −3.0% | −7.7% |
| 45° | −7.1% | −16.8% |
| 60° | −13.2% | −27.5% |
| 75° | −21.8% | −39.0% |

Use it below 20°. Above 30° the tool warns and you should treat the amplitude as a lower bound. Above
60°, change the geometry rather than the arithmetic.

## 5. Decide whether this is the right geometry at all

| Situation | Use |
|---|---|
| Amplitude below ~30°, existing rig, no changes wanted | Side view with `--radius` |
| Amplitude 30–60° | Side view, but expect several percent; or move the camera further back to reduce perspective |
| Amplitude above 60°, or full rotations | Top-down marker on the rotation axis, ideally a fiducial |
| You need direction as well as magnitude | Top-down asymmetric fiducial — a side view of a symmetric pointer cannot distinguish `+θ` from `−θ` without tracking its motion through the extremes |
| The pointer disappears at the ends of travel | Exactly the foreshortening in the table: apparent speed falls to 26% at 75° and to 2% near 90°. Move the geometry |

A top-down marker removes the chord entirely: the marker rotates in place, `θ` is measured rather than
inferred, and the pointer never approaches the silhouette. The cost is that you must see the axis, and
that a symmetric marker gives `θ mod π`.

## 6. Verify against a known angle

Put two pencil marks on the strip at a measured ±20° from centre, swing the dome until the pointer
touches each mark, and compare the tool's amplitude with 20°. If it reads 19.8° ± 0.3°, the geometry
and calibration are consistent. If it reads 18.5°, your radius is too large or your scale is off —
those are the only two inputs, so the diagnosis is quick.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `chord exceeds the stated radius` | Radius too small, or calibration scale wrong | Re-measure the radius to the strip centreline; check the scale against the calibration target |
| Amplitude warns "above 30°" | Perspective residual | Move the camera back, or switch to a top-down marker |
| Amplitude is stable but 10–20% low | Chord treated as arc | Pass `--radius` |
| Amplitude differs between clockwise and anticlockwise runs | Pointer is not on the strip centreline, so its radius changes | Re-tape the strip concentric with the axis |
| Pointer lost at the extremes of travel | Foreshortening: apparent speed drops toward the silhouette | Reduce amplitude, move the camera, or use a top-down fiducial |
| Frequency changes with amplitude | Not geometry — check for a slipping strip or a loose camera | Fix the mechanics; the estimator does not do this |

## Related

- Why the chord error is invisible in frequency: [the number is not the
  evidence](../explanation/the-number-is-not-the-evidence.md).
- Calibrating the underlying plane: [calibrate a tilted camera](calibrate-a-tilted-camera.md).
- First run, no camera needed: [your first measurement](../tutorials/first-measurement.md).
