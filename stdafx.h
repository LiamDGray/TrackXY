// stdafx.h : include file for standard system include files,
// or project specific include files that are used frequently, but
// are changed infrequently
//

#pragma once

#if 0 //TBD
//TBD begin
#undef WINVER
#undef WIN32_WINNT

#define WINVER _WIN32_WINNT_WIN7
#define WIN32_WINNT _WIN32_WINNT_WIN7
//TBD end
#endif

#include "targetver.h"

#include <stdio.h>
#include <tchar.h>



// TODO: reference additional headers your program requires here
#include "opencv2/imgproc/imgproc.hpp"

using namespace cv;
extern int hough_main( Mat& img, Mat& cimg, vector<Point2f> /*OutputArray*/ points );
extern int lkdemo_main( int argc, char** argv );
