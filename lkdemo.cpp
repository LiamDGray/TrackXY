#include <opencv2/video/tracking.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/highgui.hpp>
#include <opencv2/videoio.hpp>

#include <iostream>
#include <fstream>
#include <iomanip>
#include <ctype.h>
#include <chrono>
#include <vector>
#include <string>
#include <ctime>

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
        "Enhancements (c) 2012 Liam D. Gray\n"
        "   under BSD license.\n"
        "Third party copyrights are property of their respective owners.\n"
        << endl;

    cout << "Usage: trackx <camera number> <outputfilename>\n"
        "where <camera number> is:\n"
        "\t0 (usually a built-in webcam),\n"
        "\t1 (usually a USB camera),\n"
        "\t2, etc."
        << endl;

    cout << "\nControls: \n"
            "\tEsc - quit the program\n"
            "\tMouse-click - auto-initialize (or re-initialize) tracking and mark a new segment\n"
            "The primary point being tracked will be marked in red.\n" << endl;
}

Point2f point;
bool addRemovePt = false;

int clickcount = 0;
bool needToInit = false;
std::chrono::time_point<std::chrono::steady_clock> t1;

static void onMouse( int event, int x, int y, int /*flags*/, void* /*param*/ )
{
    if( event == EVENT_LBUTTONDOWN )
    {
        clickcount++;
        needToInit = true;
    }
}

int main(int argc, char** argv)
{
    double elapsedTime = 0, lastElapsedTime = 0;
    string filename;
    int camnumber;

    help();

    if (argc >= 2 && isdigit(argv[1][0])) { // second argument is camera number
        camnumber = argv[1][0] - '0';
    } else {
        cout << "Enter camera number: ";
        cin >> camnumber;
        cout << endl;
    }

    if (argc >= 3) { // third argument is filename to write
        filename = argv[2];
    } else {
        cout << "Enter name for new output file to be written (a .csv extension will be added): ";
        cin >> filename;
        filename += ".csv";
        cout << endl;
    }

    VideoCapture cap;
    TermCriteria termcrit(TermCriteria::COUNT|TermCriteria::EPS,20,0.03);
    Size subPixWinSize(10,10), winSize(31,31);

    const int MAX_COUNT = 3;
    needToInit = false;
    bool nightMode = false;

    cap.open(camnumber);
    if( !cap.isOpened() )
    {
        cout << "Could not initialize capturing...\n";
        return -1;
    }

    ofstream outfile (filename, ios::out);
    if (!outfile.is_open()) {
        cout << "Could not open file for output: " << filename << endl;
        return -1;
    }

    auto now = std::chrono::system_clock::now();
    std::time_t now_time = std::chrono::system_clock::to_time_t(now);

    outfile << "samplenumber, millseconds, x, y, numclicks, comments or notes" << endl;
    outfile << "0, 0, 0, 0, 0, camera number is " << camnumber << endl;
    outfile << "0, 0, 0, 0, 0, output filename is " << filename << endl;
    outfile << "0, 0, 0, 0, 0, start date / local time is " << std::ctime(&now_time);

    namedWindow( "TrackX", 1 );
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

        int copyOfClickCount = clickcount;
        if (1 == copyOfClickCount && samplenumber == 0) {
            t1 = std::chrono::steady_clock::now();
        }

        if (copyOfClickCount > 0) {
            samplenumber++;
        }

        auto t2 = std::chrono::steady_clock::now();

        frame.copyTo(image);
        cvtColor(image, gray, COLOR_BGR2GRAY);

        if( nightMode )
            image = Scalar::all(0);

        bool copyOfneedToInit = needToInit;
        if( copyOfneedToInit )
        {
            goodFeaturesToTrack(gray, points[1], MAX_COUNT, 0.01, 10, Mat(), 3, false, 0.04);
            cornerSubPix(gray, points[1], subPixWinSize, Size(-1,-1), termcrit);
            addRemovePt = false;
            needToInit = false;
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
                circle( image, points[1][i], 3, Scalar(0,255,0), -1, 8);
            }
            points[1].resize(k);
            if (points[1].size() >= 1) {
                circle( image, points[1][0],  3, Scalar(  0,  0,255), -1, 8);
                circle( image, points[1][0], 10, Scalar(255,255,255), -1, 8);

                if (copyOfClickCount > 0) {
                    elapsedTime = std::chrono::duration_cast<std::chrono::milliseconds>(t2 - t1).count();
                } else {
                    elapsedTime = 0;
                }

                if (elapsedTime < 0) {
                    elapsedTime = lastElapsedTime;
                }
                lastElapsedTime = elapsedTime;

                outfile << samplenumber << "," << (int) elapsedTime << ","
                    << (int) points[1][0].x << "," << (int) points[1][0].y << "," << clickcount << endl;
            }
        }
        
        if( addRemovePt && points[1].size() < (size_t)MAX_COUNT )
        {
            vector<Point2f> tmp;
            tmp.push_back(point);
            cornerSubPix( gray, tmp, winSize, Size(-1,-1), termcrit);
            points[1].push_back(tmp[0]);
            addRemovePt = false;
        }

        imshow("TrackX", image);

        char c = (char)waitKey(10);
        if( c == 27 ) // Escape key
            break;
        switch( c )
        {
        case 'n':
            nightMode = !nightMode;
            break;
        default:
            ;
        }

        std::swap(points[1], points[0]);
        cv::swap(prevGray, gray);
    }

    outfile.close();
    return 0;
}
