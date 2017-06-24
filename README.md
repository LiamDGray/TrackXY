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

# In more depth:

TrackXY:

 Track horizontal and vertical displacement of an object (ideally a rounded pointer) against a uniform field of contrasting color.


Output a CSV (comma-separated value) file with columns as follows:

sample number, time (from first sample) in milliseconds, x coordinate in pixels, y coordinate in pixels, number of clicks

See sample.csv for a sample output in CSV format.


USAGE:



For Windows, download OpenCV 2.4.2, extract it to a location of your choosing, set system paths so that OpenCV DLLs can be found (see  http://docs.opencv.org/2.4/doc/tutorials/introduction/windows_install/windows_install.html#windowssetpathandenviromentvariable ), and double-click trackx.exe (or type trackx at command prompt) to start TrackXY.

After starting TrackXY, a console window will open. Enter camera number (typically 0 for built-in camera  or 1 for an external camera) and press Enter. Enter a filename and press Enter. A video display window will open, showing the webcam's view.  Click the mouse in the video display window to start recording. If applicable, click again to mark each new segment with a counter that increments in the column "number of clicks."

TrackXY works with a scene in which the tracked object is singular and stands out clearly from the background. A black & white image, with black pointer on white background, or vice versa, works very well.   TrackXY has been tuned to work best when tracking a rounded pointer such as Google uses to mark a point in Google Maps.  (The included "Rounded pointer.pdf" works well when affixed to the moving object and the  camera is close to it.)  The essential thing is that, in the image, one point should be more singular than the others.  Two additional points serve as "chaperones," points of reference to help keep track of the main point.  The chaperone points tend to drift along the curved boundary between black and white, but this is okay because only one point is being logged, the one tracking the singular feature.



LICENSE (brief summary):


TrackXY is released under GNU Affero GPL.
BSD license covers the OpenCV library and Lukas-Kanade demo (lkdemo.cpp) on which TrackXY is based.
See below for full license terms.



INSTALLATION


The current code is known to compile in Microsoft Visual Studio C++ 2010 and a project file for that compiler is included.  The program has run and worked well under Windows 7.

The code has been built for OpenCV 2.4.2 and requires its DLLs for 32-bit Windows.  The Windows version also requires the Visual C++ 2010 "Redistributable Package."  These are copyright Intel and Microsoft respectively and bound by their respective terms.  They can be downloaded from the following locations:



OpenCV-2.4.2.exe (OpenCV 2.4.2 compiled for Windows):

http://sourceforge.net/projects/opencvlibrary/files/opencv-win/2.4.2/OpenCV-2.4.2.exe/download



(One inelegant but foolproof way to install the OpenCV libraries for TrackXY is to run the OpenCV .exe file to extract the self-extracting archive to <folder> and then copy the files from <folder>\build\x86\VC10\bin to the folder in which TrackX.exe resides.)



Microsoft Visual C++ 2010 Redistributable Package for x86 (32-bit Windows -- tested with TrackXY):


http://www.microsoft.com/en-us/download/details.aspx?id=5555



Microsoft Visual C++ 2010 Redistributable Package for x64 (most 64-bit Windows installations):


http://www.microsoft.com/en-us/download/details.aspx?id=14632



Microsoft Visual C++ 2010 Redistributable Package for IA64 (Windows for 64-bit Itanium):


http://www.microsoft.com/en-us/download/details.aspx?id=2054


PORTING

The original version of TrackXY was compiled with Xcode on Mac OS X Snow Leopard and ran there.  The latest version has not been compiled on Mac OS and some Windows-specific APIs are being used. I intend to make it more portable in the future.

ROAD MAP

I'd like to make it more user-friendly as well.

I welcome feature requests, suggestions, and feedback, and, of course, please feel free to check out, enhance, and submit code back into the project repository at http://github.com/LiamDGray/TrackXY

Solution designed by Liam Gray for Bill Murphy with input from Simon Tang.

DONATIONS

Please donate via my PayPal account, liamdgray@gmail.com, to support further development of TrackXY and other open-source developments.
