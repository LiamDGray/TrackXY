# The number is not the evidence

*What a rebuilt 2012 webcam tracker taught me about silent measurement errors, and about the kind of
documentation that catches them.*

In 2012 I pointed a webcam at a torsion pendulum, ran Intel's `lkdemo.cpp` sample, and wrote the
coordinates to a CSV. It worked. Fourteen years later I rebuilt it properly — C++17, OpenCV 4, tests,
calibration files — and discovered that the old version had been lying to me in a way I could not
have caught by looking at the numbers.

This is an account of three defects, each of which produced output that looked fine, and of what
finally made them visible. It ends somewhere I did not expect: at documentation.

## The number that looked wrong because another number looked right

The rebuilt tracker writes one row per frame: sample number, elapsed milliseconds, raw pixel
coordinates, calibrated millimetres, status. Calibration is two numbers — an origin and a scale —
which an operator sets by pressing `o` and `k` on a live preview.

For the pendulum I built a circular target: a marker that sweeps a 50 mm circle at 0.8 Hz. If the
instrument is honest, every number it reports has a true value I already know. That is the whole point
of a synthetic target, and it is the only reason I found any of this.

The analysis reported:

```
X  f = 0.8000 Hz   amplitude = 49.954 mm
Y  f = 0.8000 Hz   amplitude = 45.340 mm
phase (Y − X)  −89.97°
```

Frequency correct to four decimal places. Phase correct to within a twentieth of a degree. Amplitude:
one axis right, one axis short by 9.3%.

A torsion pendulum swinging in a circle should have equal amplitudes on both axes. So the instrument
was reporting an **elliptical orbit** — not with an error message, but with a confident geometric
description. If I had been measuring an unfamiliar apparatus, or a smaller misalignment, I would have
written "the orbit is slightly elliptical" in a lab notebook and moved on. The number would have
entered the record as a physical fact about the pendulum rather than a fact about my camera.

## Why it happened, and why nothing warned me

The camera was 25° off the normal to the target plane. A translation and a single scale — which is
what the 2012 code used, and what the 2026 rebuild inherited — cannot represent that. A tilt
compresses one axis of the image by exactly `cos θ`; at 25° that is 0.906, so the measured amplitude
on that axis is 9.4% short. The measurement is not noisy or random. It is *consistently* wrong, which
is worse: averaging does not help, and repeated runs agree with each other.

Two properties made this invisible to me:

**It does not affect frequency.** A linear distortion scales position; it cannot change the rate at
which position oscillates. So the headline number — the one I would have quoted, the one the
experiment was designed to measure — was perfect. Everything downstream looked trustworthy because
the first thing I checked was correct.

**It masquerades as physics.** An ellipse *is* a possible orbit. The instrument did not report
"amplitude mismatch, check your calibration"; it reported a 90° phase difference between axes with
unequal amplitudes, which is a coherent description of elliptical motion. The failure mode was
indistinguishable from a result.

The fix is not a correction factor. It is a different calibration model. Four points on a printed
square define a homography — the full projective mapping from the target plane to the image — and a
homography removes tilt without knowing the angle:

| Radius from calibration origin | Uniform scale + origin | Homography |
|---|---|---|
| 10 mm | 0.55 mm error | < 0.001 mm |
| 25 mm | 1.63 mm error | < 0.001 mm |
| 50 mm | 4.06 mm error | < 0.001 mm |
| 80 mm | 7.97 mm error | < 0.001 mm |

Same data, same estimator, same tracker. The difference between a 9% error and a 0.01% error is one
calibration model, and the reason I could not see it before is that nothing in the output said
"amplitude is where this instrument is weakest."

## The second defect had a confidence interval

The frequency number was correct in the run above, but not for the reason I assumed. The 2012 analyser
finds where the signal crosses its own mean and takes the average half-period between crossings. That
is a fine definition for a signal that never decays. A pendulum decays.

On a damped signal, mean crossings are not evenly spaced; the envelope pulls them together. The
resulting frequency estimate is biased, and the bias grows with damping. I measured it by fitting a
damped sinusoid `A·e^(−γt)·cos(2πft + φ) + c` to the same data and comparing, over 200 trials at each
noise level:

| Signal-to-noise | Zero-crossing frequency error | Fit frequency error | Fit phase error (median) |
|---|---|---|---|
| 40 dB | 9 mHz | 0.06 mHz | 0.04° |
| 30 dB | 136 mHz | 0.20 mHz | 0.13° |
| 20 dB | 1219 mHz | 0.62 mHz | 0.41° |
| 10 dB | 5198 mHz | 1.21 mHz | 1.06° |

At a realistic webcam noise level the old estimator is off by 1.2 Hz on a 1.7 Hz signal — 70%. The
fit is off by less than a millihertz, and it also returns the damping coefficient, which the old
method could not produce at all.

But the row that matters most is 10 dB. My first version of the fit, unbounded, returned a frequency
error of 594 Hz **while reporting convergence**. It had walked to a different local minimum and was
perfectly happy there. Bounding the search fixed the divergence; what remained was a fit that could
not distinguish signal from noise, so I gave it a way to say so. At 10 dB it now rejects 193 of 200
trials.

That is the design decision I keep coming back to. An instrument that cannot abstain will lie with a
straight face. An instrument that reports `reliable: false` is more useful than one that reports
0.8 Hz ± 0.0000, because the second is indistinguishable from a good measurement and the first starts
a conversation.

## The third defect is not in the software

A homography corrects the plane the calibration target sits in. It says nothing about the plane the
marker sits in. If the marker is 20 mm above the calibrated surface and the camera is 25° off normal,
the marker appears displaced by roughly `h · tan θ` — about 9 mm. That is *larger* than the tilt error
the homography just removed, and no amount of software fixes it, because the software is being told
the wrong geometry.

The same is true of lens distortion: a wide webcam at close range bends straight lines near the frame
edge by several pixels, and no homography will unbend them. Either you calibrate the camera and
undistort, or you restrict measurement to the central third of the frame and write that down.

So the taxonomy of geometric error is: one part software (tilt), one part procedure (marker height),
one part optics (distortion). Only two of the three are fixable in a commit. The third is fixable only
by telling the operator what to do — which is documentation, or it is a bug report waiting to happen.

## What actually makes a number checkable

Fixing the estimator and the calibration made the instrument accurate. It did not make it
*trustworthy*, because accuracy under my own hands says nothing about a number arriving in someone
else's inbox as a CSV attachment.

A CSV is a claim. Anyone can edit a row, delete the segment where the tracker lost the target, or
re-run with a different scale and present the result as the original. So the tool now emits a receipt:
SHA-256 digests of the CSV, the calibration file and the source video; a hash chain over the CSV rows;
the analysis parameters that change the numbers without changing the file bytes; and a manifest root
over all of it. Verification recomputes every field and reports the first divergence.

This gives two different guarantees, and conflating them is the usual mistake:

- **Integrity** — these are the numbers the receipt describes. A hash chain gives this. It is weak:
  a hash proves a file is unchanged, not that it was produced by anything in particular.
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

The tilt error was caught because someone wrote down that the calibration is a translation and a
uniform scale, which made "what if the camera is tilted?" a question with an answer.
The estimator bias was caught because the method was documented precisely enough to be compared
against an alternative.
The marker-height error cannot be fixed at all without a document telling an operator which plane to
calibrate in.

This is the argument I would make to anyone who thinks documentation is what you write after the
engineering is done. Documentation is how an instrument knows what it cannot measure. A tool that
reports 49.954 and 45.340 without a word about calibration geometry is not honest — it is merely
confident. The four documents that fix that are different in kind, not in length:

- **A tutorial** that gets you from nothing to one number, so you can form a first impression.
- **A how-to** for a specific job — calibrate a tilted camera — because that is what you need on the
  day the tilt is real.
- **A reference** that states contracts and schemas, so you can predict behaviour without running
  anything.
- **An explanation** like this one, which is where the reasoning lives: why the error exists, why the
  obvious fix is wrong, and what the instrument still cannot do.

The best documentation, though, is the part that fires at the moment of the mistake rather than in a
document nobody opens. When the tool sees an affine calibration it now says:

```
warnings
 - affine calibration: any camera tilt appears as amplitude error
   that grows with distance from the origin
```

That sentence is documentation. It is eighteen words, it is in the right place, and it would have
saved me fourteen years of trusting a number that was wrong by 9%.

The pendulum never cared. It swung in a circle either way, and it would have swung in a circle if I
had reported the orbit as elliptical. Only the reader of the number cares — and the reader is who
documentation is for.
