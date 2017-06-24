# TrackXY
Track position of a point in webcam, in realtime, based on OpenCV's Lukas-Kanade demo code.
Originally designed to enable a torsion pendulum experiment.

Tracks and logs the X (horizontal) and Y (vertical) coordinates of a selected point over time.
(Y increases from top to bottom)

Built in summer 2012 with OpenCV version 2.4.2.
Based on OpenCV's demo of Lukas-Kanade optical flow (lkdemo.cpp).

These are used under BSD license and are Copyright (C) 2000-2006, Intel Corporation, all rights reserved.

Adapted for logging motion of a point (while tracking two auxillary points)
by Liam Gray with input from Bill Murphy and Simon Tang.

Enhancements (c) 2012 Liam D. Gray and released 2017 under GNU Affero GPL: https://www.gnu.org/licenses/agpl-3.0.en.html

Third party copyrights are property of their respective owners.

# Usage
trackx <camera number> <outputfilename>
		where <camera number> is:
  		0 (usually a built-in webcam)
	  	1 (usually a USB camera)
		  2, etc.

Controls:
  Esc - quit the program
  Mouse-click - auto-initialize (or re-initialize) tracking and mark a new segment

The primary point being tracked will be marked in red.
