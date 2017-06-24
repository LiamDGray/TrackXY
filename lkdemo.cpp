#include "stdafx.h"
#include "opencv2/video/tracking.hpp"
#include "opencv2/imgproc/imgproc.hpp"
#include "opencv2/highgui/highgui.hpp"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <ctype.h>
//TBD#include <Windows.h>
#include <windows.h>

using namespace cv;
using namespace std;

static void help()
{
    // print a welcome message and the OpenCV version
    cout << "\nTrackX tracks and logs the X (horizontal) and Y (vertical) coordinates of a selected point over time.\n"
		"(Y increases from top to bottom)\n"
		"It is built with OpenCV version " << CV_VERSION << 
		"   and is based on its demo of Lukas-Kanade optical flow (lkdemo.cpp)\n"
		"These are used under BSD license and are\n"
		"Copyright (C) 2000-2006, Intel Corporation, all rights reserved.\n"
		"Adapted for logging motion of a point (while tracking two auxillary points)\n"
		"   by Liam Gray with input from Bill Murphy and Simon Tang.\n"
		"Enhancements (c) 2012 Liam D. Gray <lgray95@alumni.carnegiemellon.edu>\n"
		"   under BSD license.\n"
		"Third party copyrights are property of their respective owners.\n"
        << endl;

    cout << "Usage: trackx <camera number> <outputfilename>\n"
		"where <camera number> is:\n"
		"\t0 (usually a built-in webcam),\n"
		"\t1 (usually a USB camera),\n"
		"\t2, etc."
		<<endl;

	cout <<	"\nControls: \n"
            "\tEsc - quit the program\n"
			"\tMouse-click - auto-initialize (or re-initialize) tracking and mark a new segment\n"
			"The primary point being tracked will be marked in red.\n" << endl;
}

Point2f point;
bool addRemovePt = false;

int clickcount = 0;
bool needToInit = false;
LARGE_INTEGER t1, t2;           // ticks

CRITICAL_SECTION t1Section, clickcountSection, needToInitSection;

/*
void WINAPI InitializeCriticalSection(
  _Out_  LPCRITICAL_SECTION lpCriticalSection
);
*/

/*
void WINAPI EnterCriticalSection(
  _Inout_  LPCRITICAL_SECTION lpCriticalSection
);
*/

static void onMouse( int event, int x, int y, int /*flags*/, void* /*param*/ )
{
    if( event == CV_EVENT_LBUTTONDOWN )
    {
//	cout << "in onMouse(): threadID is " << GetCurrentThreadId() << endl;
	// By that, we learned that, currently, this function runs in same thread as main part, probably from waitKey().

//		EnterCriticalSection(&clickcountSection); // for threadsafety, since this event-driven function /could/ run outside the app's main thread
		clickcount++;
//		LeaveCriticalSection(&clickcountSection);
//		EnterCriticalSection(&needToInitSection);
		needToInit = true; // TBD do this or not. if so, document it. consider having it start a new (numbered) file
//		LeaveCriticalSection(&needToInitSection);
    }
}

int _tmain(int argc, TCHAR* argv[])
//int main(int argc, char** argv)
//int lkdemo_main( int argc, char** argv )
{
	LARGE_INTEGER frequency;        // ticks per second
    double elapsedTime, lastElapsedTime;
	char filename[300];

	// DWORD WINAPI GetThreadId(void);
//	cout << "in _tmain(): threadID is " << GetCurrentThreadId() << endl;

	VideoCapture cap;
    TermCriteria termcrit(CV_TERMCRIT_ITER|CV_TERMCRIT_EPS,20,0.03);
    Size subPixWinSize(10,10), winSize(31,31);

    const int MAX_COUNT = 3 /*500*/;
    needToInit = false;
    bool nightMode = false;
	int camnumber;
	int digitpressed = 0;
	clickcount = 0;
/* if( argc == 1 || (argc == 2 && strlen(argv[1]) == 1 && isdigit(argv[1][0])))
	        cap.open(argc == 2 ? argv[1][0] - '0' : 0);
	else if( argc == 2 )
	        cap.open(argv[1]);
*/
    help();

	if (argc >= 2 && strlen((const char *)argv[1]) == 1 && isdigit(argv[1][0])) { // second argument is camera number
        camnumber = argv[1][0] - '0';
	} else {
		cout << "Enter camera number: ";
		cin >> camnumber;
		cout << endl;
	}

	if (argc >= 3) { // third argument is filename to write
		strcpy_s((char *)filename, 300, (const char *)argv[2]);
	} else {
		cout << "Enter name for new output file to be written (a .csv extension will be added): ";
		cin >> filename;
//		TBD append .csv to filename.
		strcpy_s((char *)&filename[strlen(filename)], 5, ".csv");
		cout << endl;
	}
/*
	int errnum = fopen_s(&pFile, (char *)filename, "a");
	if (errnum) {
		cout << "Could not open file for output...\n";
		return -1;
	}
*/

	SYSTEMTIME localTime;
	GetLocalTime(&localTime);

//	InitializeCriticalSection(&t1Section);
//	InitializeCriticalSection(&clickcountSection);
//	InitializeCriticalSection(&needToInitSection);

	// get ticks per second
    QueryPerformanceFrequency(&frequency);

	cap.open(camnumber);
    if( !cap.isOpened() )
    {
        cout << "Could not initialize capturing...\n";
        return -1;
    }
//	double pos_msec, pos_frames, pos_fps, pos_fourcc, pos_frame_count;

/*
double cvGetCaptureProperty(CvCapture* capture, int property_id)
Gets video capturing properties.

Parameters:	
capture – video capturing structure.
property_id –
Property identifier. Can be one of the following:
CV_CAP_PROP_POS_MSEC - Film current position in milliseconds or video capture timestamp
CV_CAP_PROP_POS_FRAMES - 0-based index of the frame to be decoded/captured next
CV_CAP_PROP_POS_AVI_RATIO - Relative position of the video file (0 - start of the film, 1 - end of the film)
CV_CAP_PROP_FRAME_WIDTH - Width of the frames in the video stream
CV_CAP_PROP_FRAME_HEIGHT - Height of the frames in the video stream
CV_CAP_PROP_FPS - Frame rate
CV_CAP_PROP_FOURCC - 4-character code of codec
CV_CAP_PROP_FRAME_COUNT - Number of frames in the video file
CV_CAP_PROP_BRIGHTNESS - Brightness of the image (only for cameras)
CV_CAP_PROP_CONTRAST - Contrast of the image (only for cameras)
CV_CAP_PROP_SATURATION - Saturation of the image (only for cameras)
CV_CAP_PROP_HUE - Hue of the image (only for cameras)
*/
	ofstream outfile ((char *)filename, ios::out);
	if (!outfile.is_open()) {
		return -1;
	}
	outfile << "samplenumber, millseconds, x, y, numclicks, comments or notes" << endl;
//	outfile << "0, 0, 0, 0, 0, program location is " << String(const char[] argv[0]) << endl;
	outfile << "0, 0, 0, 0, 0, camera number is " << camnumber << endl;
	outfile << "0, 0, 0, 0, 0, output filename is " << filename << endl;
	outfile << "0, 0, 0, 0, 0, ticks per second is " << (long)frequency.QuadPart << endl;
	outfile << "0, 0, 0, 0, 0, start date / local time is " 
		<< localTime.wYear << "/" << localTime.wMonth << "/" << localTime.wDay << " at "
		<< localTime.wHour << ":" << localTime.wMinute << ":" << localTime.wSecond << endl;

//	pos_fps = cap.get(CV_CAP_PROP_FPS);
//	pos_fourcc = cap.get(CV_CAP_PROP_FOURCC); // - 4-character code of codec
//	outfile << "0, 0, 0, 0, 0, FPS is " << pos_fps << ", fourcc is " << pos_fourcc << endl;

	namedWindow( "TrackX", 1 ); // crashes here but only in Debugger. why? TBD
    setMouseCallback( "TrackX", onMouse, 0 );

    Mat gray, prevGray, image;
    vector<Point2f> points[2];

	int samplenumber = 0;

    for(;;)
    {
        Mat frame;

		cap >> frame;
        if( frame.empty() )
            break;

		int copyOfClickCount;
//		EnterCriticalSection(&clickcountSection); // for threadsafety, since this event-driven function will run outside the app's main thread
		copyOfClickCount = clickcount;
//		LeaveCriticalSection(&clickcountSection); // for threadsafety, since this event-driven function will run outside the app's main thread
		if (1==copyOfClickCount) {
			// Initialize numsamples and millisecond timer.
//			EnterCriticalSection(&t1Section);
		    QueryPerformanceCounter(&t1);
//			LeaveCriticalSection(&t1Section);
		}

		if (copyOfClickCount > 0) {
			samplenumber++;
		}
		// get timestamp here -- of approx time of frame capture.
		// may want to run this only every Nth time or every 1 sec or 100ms tops TBD
		// or TBD may want to start it only when file writing starts (after a click)
		// compute and print the elapsed time (in millisec) and the x coordinate of the point of interest
		QueryPerformanceCounter(&t2);

/*
		pos_msec = cap.get(CV_CAP_PROP_POS_MSEC);
		pos_frames = cap.get(CV_CAP_PROP_POS_FRAMES);
		pos_frame_count = cap.get(CV_CAP_PROP_FRAME_COUNT); // - Number of frames in the video file
*/
		frame.copyTo(image);
        cvtColor(image, gray, CV_BGR2GRAY);

		// put the Hough circle recognition here
//TBD		hough_main( gray, image, points[1] );

        if( nightMode )
            image = Scalar::all(0);

		bool copyOfneedToInit;
//		EnterCriticalSection(&needToInitSection); // for threadsafety, since this event-driven function will run outside the app's main thread
		copyOfneedToInit = needToInit;
//		LeaveCriticalSection(&needToInitSection); // for threadsafety, since this event-driven function will run outside the app's main thread
		if( copyOfneedToInit )
        {
			// automatic initialization
			//TBD select sub-region before this step?
            goodFeaturesToTrack(gray, points[1], MAX_COUNT, 0.01, 10, Mat(), 3, 0, 0.04);
            cornerSubPix(gray, points[1], subPixWinSize, Size(-1,-1), termcrit);
            addRemovePt = false;
        }
        else if( !points[0].empty() )
        {
            vector<uchar> status;
            vector<float> err;
            if(prevGray.empty())
                gray.copyTo(prevGray);
            calcOpticalFlowPyrLK(prevGray, gray, points[0], points[1], status, err, winSize,
                                 3, termcrit, 0, 0.001);
            size_t i, k;

			for( i = k = 0; i < points[1].size(); i++ )
            {
                if( addRemovePt )
                {
                    if( norm(point - points[1][i]) <= 5 )
                    {
                        addRemovePt = false;
                        continue;
                    }
                }

                if( !status[i] )
                    continue;

                points[1][k++] = points[1][i];
				circle( image, points[1][i], 3, Scalar(0,255,0), -1, 8); // green circle
				// we just plotted the green circle at the point.
			}
	        points[1].resize(k);
			if (points[1].size() >= 1) {
				//TBD
				circle( image, points[1][0],  3, Scalar(  0,  0,255), -1, 8); // red circle at 0th (tracked) point
				circle( image, points[1][0], 10, Scalar(255,255,255), -1, 8); // larger white circle around 0th (tracked) point

//				EnterCriticalSection(&t1Section);
				elapsedTime = double((t2.QuadPart - t1.QuadPart)) * 1000 / double(frequency.QuadPart); // in ms
//				LeaveCriticalSection(&t1Section);

				if (elapsedTime < 0) {
					elapsedTime = lastElapsedTime;
				}
				lastElapsedTime = elapsedTime;

				outfile << samplenumber << "," << (int) elapsedTime << ","
					<< (int) points[1][0].x << "," << (int) points[1][0].y;
//				if (digitpressed > -1) {
//					outfile << ", digit pressed: " << String(digitpressed);
//				}
				outfile << "," << clickcount; // use these to mark segments of the run, such as pre-subject, subject, and post-subject
//				outfile << ","; // comments would go here, but there are none.
//				outfile << "," << pos_msec << "," << pos_frames << "," << pos_frame_count;
				outfile << endl;
			}
        }
		
        if( addRemovePt && points[1].size() < (size_t)MAX_COUNT )
        {
            vector<Point2f> tmp;
            tmp.push_back(point);
            cornerSubPix( gray, tmp, winSize, cvSize(-1,-1), termcrit);
            points[1].push_back(tmp[0]);
            addRemovePt = false;
        }

//		EnterCriticalSection(&needToInitSection); // for threadsafety, since this event-driven function will run outside the app's main thread
        needToInit = false;
//		LeaveCriticalSection(&needToInitSection); // for threadsafety, since this event-driven function will run outside the app's main thread

		imshow("TrackX", image);

		digitpressed = -1; // means no digit press recognized yet

        char c = (char)waitKey(10); // TBD consider moving this to another thread.
        if( c == 27 ) // Escape key
            break;
        switch( c )
        {
//        case 'r':
//            needToInit = true; // consider using mouse press for this, and having it start a new (numbered) file
//            break;
//        case 'c':
//            points[1].clear();
//            points[0].clear(); //TBD
//            break;
        case 'n':
            nightMode = !nightMode;
            break;
		case '0':
		case '1':
		case '2':
		case '3':
		case '4':
		case '5':
		case '6':
		case '7':
		case '8':
		case '9':
			digitpressed = c;
			break;
        default:
            ;
        }

        std::swap(points[1], points[0]);
        swap(prevGray, gray);
    }

	outfile.close();

//	DeleteCriticalSection(&t1Section);
//	DeleteCriticalSection(&clickcountSection);
//	DeleteCriticalSection(&needToInitSection);

    return 0;
}

/*
int _tmain(int argc, TCHAR* argv[])
{
	lkdemo_main(argc, (char **) argv);
	return 0;
}
*/
