# The number is not the evidence

*What a rebuilt 2012 webcam tracker taught me about silent measurement errors, and about the kind of
documentation that catches them.*

In 2012 I needed to measure the rotation of a dome — a mesh food cover, the kind that keeps flies off
a plate at a picnic, a bit over a foot across. I taped a strip of white paper around its
circumference, drew a black pointer on it shaped like a map pin, and put a webcam about two feet away,
looking at that strip side-on. Then I ran Intel's `lkdemo.cpp` sample, tracked the pointer, and wrote
its coordinates to a CSV. It worked. Fourteen years later I rebuilt it properly — C++17, OpenCV 4,
tests, calibration files — and discovered that the old version had been telling me a number that was
not the number I thought I was measuring.

This is an account of three defects, each of which produced output that looked fine, and of what
finally made them visible. It ends somewhere I did not expect: at documentation.

## The apparatus was smarter than the software

Two decisions in that 2012 rig were better than I knew at the time.

The **white paper strip** is the first. A mesh dome is a regular grid of holes: to a corner detector it
is thousands of identical features, and Lucas–Kanade cannot tell one wire crossing from the next. The
strip removes the periodicity across the band where the pointer travels, giving the tracker one
high-contrast feature against a uniform background. Without it, the tracker hops between holes and the
data is nonsense. I chose the strip because it was the obvious way to see the pointer; it was also the
only reason the measurement worked.

The **pointer shape** is the second. A map-pin has a blob above a point, so it is easy to detect and it
has an unambiguous tip — useful when the thing you want is a single coordinate.

What the rig did not have was any notion of *angle*. The CSV recorded pixels; calibration turned them
into millimetres. But a pointer travelling around the circumference of a cylinder does not move in a
straight line, and its horizontal image position is not the distance it has travelled.

## The number that looked wrong because another number looked right

For the geometry of that rig, the pointer's horizontal position is a chord:

```
x(t) = r · sin θ(t)
```

with `r` the dome radius — about 152 mm for a one-foot dome. To recover the angle you have to invert
that: `θ = asin(x / r)`. If you instead treat the chord in millimetres as an arc length, dividing by
the radius gives an angle that is wrong by exactly the ratio `sin θ / θ`:

| Amplitude | Chord reads | Apparent speed at the extreme |
|---|---|---|
| ±10° | 0.5% low | 98% |
| ±20° | 2.0% low | 94% |
| ±30° | 4.5% low | 87% |
| ±45° | 10.0% low | 71% |
| ±60° | 17.3% low | 50% |
| ±75° | 26.2% low | 26% |

Two things about this table matter more than the numbers.

First, **the error is systematic**. It is not noise; repeated runs agree with each other. Averaging
does not help, and a confidence interval computed the usual way will be confidently wrong.

Second, **it is invisible in the quantity you are most likely to quote**. Frequency is unaffected — a
geometric distortion of position cannot change a rate. When I simulated this geometry at 0.8 Hz and
amplitudes from 5° to 75°, the recovered frequency was within 0.1 mHz at every amplitude while the
amplitude error grew from 1% to 20%. The number a torsion-pendulum experiment exists to measure — the
period — was perfect. The number that tells you how hard you are driving it was the one drifting.

The correction itself is one line, and it is enough up to about 20°:

| True amplitude | `asin` inversion | Treating the chord as an arc |
|---|---|---|
| 10° | −0.3% | +0.3% |
| 20° | −1.2% | −3.0% |
| 30° | −2.7% | −7.3% |
| 45° | −6.2% | −15.9% |
| 60° | −11.8% | −26.3% |
| 75° | −19.8% | −37.6% |

The residual is perspective: the pointer is 152 mm closer to the camera at the front of the dome than
at the sides, and `asin` does not know that. A full camera model does, which is why the honest
statement is not "the tool measures angle" but "the tool measures angle to within 1% below 20°, and
you need better geometry above that."

## The second geometry has a different error

When I rebuilt the instrument I also wanted a top-down view, looking at the dome's axis instead of its
rim, because a marker there rotates in place: no arc to traverse, no foreshortening, no pointer
disappearing over the horizon. That rig has different geometry — a plane, not a cylinder — and a
different characteristic error.

A camera that is not square-on to a plane cannot be calibrated with a translation and a single scale.
A tilt compresses one axis of the image by `cos θ`; at 25° that is 0.906, so amplitudes on that axis
come out 9.4% short. I simulated a 50 mm circular target at 0.8 Hz, filmed at 25°, tracked with 0.2 px
of noise, and ran the full analysis:

| Calibration | X amplitude | Y amplitude | Frequency error |
|---|---|---|---|
| Uniform scale + origin | 49.954 mm (−0.1%) | **45.340 mm (−9.3%)** | 0.00 mHz |
| Four-corner homography | 49.993 mm (−0.01%) | 49.993 mm (−0.01%) | 0.01 mHz |

A circular target reported as an ellipse. Not with an error message — with a confident geometric
description, plus a phase of −89.97° that says "quadrature, elliptical orbit". If I had been measuring
an unfamiliar apparatus I would have written "the orbit is slightly elliptical" in a notebook and moved
on. The instrument would have been believed.

The fix for this one is a different calibration model, not a correction factor: four points on a
printed square define a homography, the full projective mapping from the plane to the image, and a
homography removes tilt without knowing the angle.

So the two geometries fail differently, and the failure is in the reader's mental model each time. On
the cylinder, a millimetre reading is a chord and the angle is under-reported. On the plane, an
off-axis camera is an ellipse and one axis is under-reported. Both produce numbers that look smooth,
reproducible, and physical.

## The third defect had a confidence interval

The frequency in that first table was correct, but not for the reason I assumed. The 2012 analyser finds
where the signal crosses its own mean and averages the half-period between crossings. That is a fine
definition for a signal that never decays. A pendulum decays.

On a damped signal the crossings are not evenly spaced; the envelope pulls them together, and the
resulting frequency estimate is biased. I measured it by fitting a damped sinusoid
`A·e^(−γt)·cos(2πft + φ) + c` to the same data, over 200 trials at each noise level:

| Signal-to-noise | Zero-crossing frequency error | Fit frequency error | Fit phase error (median) |
|---|---|---|---|
| 40 dB | 9 mHz | 0.06 mHz | 0.04° |
| 30 dB | 136 mHz | 0.20 mHz | 0.13° |
| 20 dB | 1219 mHz | 0.62 mHz | 0.41° |
| 10 dB | 5198 mHz | 1.21 mHz | 1.06° |

At a realistic webcam noise level the old estimator is off by 1.2 Hz on a 1.7 Hz signal — 70%. The fit
is off by less than a millihertz, and it also returns the damping coefficient, which the old method
could not produce at all.

But the row that matters most is 10 dB. My first version of the fit, unbounded, returned a frequency
error of 594 Hz **while reporting convergence**. It had walked to a different local minimum and was
perfectly happy there. Bounding the search fixed the divergence; what remained was a fit that could
not distinguish signal from noise, so I gave it a way to say so. At 10 dB it now rejects 193 of 200
trials.

That is the design decision I keep coming back to. An instrument that cannot abstain will lie with a
straight face. An instrument that reports `reliable: false` is more useful than one that reports
0.8 Hz ± 0.0000, because the second is indistinguishable from a good measurement and the first starts
a conversation.

## The fourth defect is not in the software

A homography corrects the plane the calibration target sits in. It says nothing about the plane the
marker sits in. If a marker is 20 mm above the calibrated surface and the camera is 25° off normal, the
marker appears displaced by roughly `h · tan θ` — about 9 mm. That is *larger* than the tilt error the
homography just removed, and no software fixes it, because the software is being told the wrong
geometry.

The same is true of lens distortion: a wide webcam at close range bends straight lines near the frame
edge by several pixels, and no homography unbends them. Either you calibrate the camera and undistort,
or you restrict measurement to the central third and write that down.

So the taxonomy of geometric error is: one part software, one part procedure, one part optics. Only
two of the three are fixable in a commit. The third is fixable only by telling the operator what to
do — which is documentation, or it is a bug report waiting to happen.

## What actually makes a number checkable

Fixing the geometry made the instrument accurate. It did not make it *trustworthy*, because accuracy
under my own hands says nothing about a number arriving in someone else's inbox as a CSV attachment.

A CSV is a claim. Anyone can edit a row, delete the segment where the tracker lost the target, or
re-run with a different scale and present the result as the original. So the tool now emits a receipt:
SHA-256 digests of the CSV, the calibration file and the source video; a hash chain over the CSV rows;
the analysis parameters that change the numbers without changing the file bytes; and a manifest root
over all of it. Verification recomputes every field and reports the first divergence.

This gives two different guarantees, and conflating them is the usual mistake:

- **Integrity** — these are the numbers the receipt describes. A hash chain gives this. It is weak: a
  hash proves a file is unchanged, not that it was produced by anything in particular.
- **Recomputability** — given the same frames, calibration and parameters, running the tool
  reproduces these numbers. This is the stronger claim, and it is why the receipt records parameters
  that do not affect the CSV bytes at all. Without them, "same file" says nothing about "same result".

The gap that remains is honest and worth stating plainly: the receipt covers the file, not the frames.
A spliced analysis is still possible. Binding each row to the frame index it came from — and therefore
to an attested capture hash — is the next step, and it is the reason this project is worth connecting
to [RealPeep](https://github.com/LiamDGray/realpeep), which attests that a video came from real
hardware at a real time without identifying the device.

A receipt cannot prove the apparatus was set up correctly, that the calibration target was the right
length, or that the camera was not pointed at a photograph. It proves the chain from attested capture
to arithmetic is intact. That is a narrower claim than "the science is right", and it is the only one
worth making.

## The turn

Here is what I did not expect from this project.

Every defect above was invisible in the output and obvious in the documentation. Not in prose that
advertises the project — in the specific, unfashionable documents that answer "what does this number
mean, and when should I not believe it?"

The chord error was caught because someone wrote down the geometry: a pointer on the circumference of
a cylinder does not travel in a straight line. The tilt error was caught because someone wrote down
that the calibration is a translation and a uniform scale, which made "what if the camera is tilted?"
a question with an answer. The estimator bias was caught because the method was documented precisely
enough to be compared against an alternative. The marker-height error cannot be fixed at all without a
document telling an operator which plane to calibrate in.

This is the argument I would make to anyone who thinks documentation is what you write after the
engineering is done. Documentation is how an instrument knows what it cannot measure. A tool that
reports 49.954 and 45.340 without a word about calibration geometry is not honest — it is merely
confident. The four documents that fix that are different in kind, not in length:

- **A tutorial** that gets you from nothing to one number, so you can form a first impression.
- **A how-to** for a specific job — measure rotation from a side view, calibrate a tilted camera —
  because that is what you need on the day the geometry is wrong.
- **A reference** that states contracts and schemas, so you can predict behaviour without running
  anything.
- **An explanation** like this one, which is where the reasoning lives: why the error exists, why the
  obvious fix is wrong, and what the instrument still cannot do.

The best documentation, though, is the part that fires at the moment of the mistake rather than in a
document nobody opens. When the tool sees a chord amplitude that implies an implausible angle, it now
says:

```
warnings
 - small-angle shortcut would report 37.8° instead of 42.2° (10% low)
 - amplitude above 30°: the asin inversion ignores the perspective term
   and under-reports by several percent
```

Those two sentences are documentation. They are in the right place, they name the error and its
direction, and they would have saved me fourteen years of trusting a number that was wrong by ten
percent.

The dome never cared. It turned either way, and it would have turned if I had reported the angle as
16% smaller than it was. Only the reader of the number cares — and the reader is who documentation is
for.
