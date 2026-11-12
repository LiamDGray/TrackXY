# How to calibrate a tilted camera

**Use this when** the camera cannot be made square-on to the target plane and the measurement must
still be in physical units. A tilt is not a nuisance you can ignore: it compresses one axis of the
image by `cos θ` — 9.4% at 25° — and the analysis will report that compression as a smaller
amplitude, with no error message.

**You will need:** a printed square of known size (120 mm works well), a ruler, a flat surface, and
about five minutes.

## 1. Decide which plane you are calibrating

Calibrate the plane **the marker moves in**, not the table the apparatus sits on.

This is the step people get wrong, and the error is larger than the one you are fixing. A marker
sitting 20 mm above the calibrated plane appears displaced by roughly `h · tan θ`; at 25° that is
9 mm — bigger than the 4 mm tilt error a homography removes at 50 mm radius.

If the marker is on a raised platform, put the calibration target on that platform.

## 2. Place the target in the measurement plane

- Centre it on the region the target will move through.
- Keep it flat. A warped print is a curved plane.
- Fill a good part of the frame — at least a third of the width. Small targets make the corner
  coordinates inaccurate, and that error propagates into everything.
- Keep it away from the extreme frame edges if your lens distorts; see step 7.

## 3. Record the four corners in pixels

You need each corner's position in the image. Any of these works:

- **From a screenshot:** open a frame in an image viewer that shows cursor coordinates and read the
  four corners. A 1 px mis-click costs little; a consistent 5 px error does not.
- **From the tracker:** draw an ROI around the target and read the rectangle from the debug overlay.
- **From an ArUco or chessboard detector:** if you already have one, its corner ordering is more
  reliable than clicking.

Write them down in a consistent order — for example top-left, top-right, bottom-right, bottom-left —
and use the same order for the physical coordinates in the next step.

## 4. Record the same corners in physical units

Choose an origin. The centre of the square is convenient: then the corners are
`(−60, −60), (60, −60), (60, 60), (−60, 60)` for a 120 mm square.

Measure the square with a ruler rather than trusting the printer. Printers scale by a percent or two,
and that becomes a systematic scale error.

## 5. Write the calibration file

Convention: `src` is the image (pixels), `dst` is the physical plane (units). The fitted homography
therefore maps pixels to units, which is the direction the analysis needs.

```json
{
  "model": "homography",
  "src": [[182.4, 141.9], [612.0, 139.1], [615.7, 486.3], [179.2, 489.8]],
  "dst": [[-60, -60], [60, -60], [60, 60], [-60, 60]]
}
```

Save it next to the recording as, say, `camera.calibration.json`. Keep it with the data: a calibration
without its recording is unverifiable.

## 6. Check the reprojection error before you trust it

```bash
cd js
node src/cli.js analyze --csv run.csv --calib camera.calibration.json
```

The report's `calibration` line shows the model and its error:

```
  calibration    homography (reprojection 0.31 px)
```

**Under 0.5 px** — good. **0.5–2 px** — usable for coarse work; re-click the corners. **Above 2 px** —
do not use this calibration; see the table below.

## 7. Troubleshoot

| Symptom | Likely cause | Fix |
|---|---|---|
| Reprojection error above 2 px, one corner worst | Mis-clicked or occluded corner | Re-read that corner; do not "average" it away |
| Reprojection error high on all corners | The four points are not planar, or the target is warped | Flatten the target; re-seat it on the plane |
| Error is small but amplitudes stay unequal | Marker is above the calibrated plane (§1), or lens distortion | Calibrate at the marker plane; move the motion toward the frame centre |
| Error is small, but scale is consistently off by a few % | Printed square is not its nominal size | Measure the print with a ruler and use that number |
| Straight edges near the frame border look curved | Barrel distortion from a wide lens | Undistort first (`cv::calibrateCamera`, one-time per camera), or restrict measurement to the central third |
| Same recording gives different amplitudes in different runs | The tracked feature is changing, not the calibration | Check the tracker's identity contract in [architecture](../architecture.md) |

## 8. Verify against a known motion

The cheapest end-to-end check is a circular target whose radius you can measure with a ruler. Sweep
it, analyse, and confirm both axes report the same amplitude within their uncertainties. If they do
not, the fault is geometry, not the estimator — the estimator has no reason to prefer one axis.

This is the check that found the 9.3% error in the original calibration: a synthetic circle with a
known radius, analysed through both models.

## Related

- Why the affine model cannot represent a tilt, with measurements: [the number is not the
  evidence](../explanation/the-number-is-not-the-evidence.md).
- What each field in the analysis means: [your first measurement](../tutorials/first-measurement.md).
- Contracts and schema: [architecture](../architecture.md).
