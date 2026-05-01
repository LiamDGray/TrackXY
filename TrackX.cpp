#include <opencv2/highgui.hpp>
#include <opencv2/videoio.hpp>
#include <opencv2/imgproc.hpp>
#include <iostream>
#include <fstream>
#include <chrono>
#include <ctime>
#include "src/Tracker.hpp"

#include "src/InputHandler.hpp"

using namespace cv;
using namespace std;

static void help() {
    cout << "\nTrackXY Modernized\n"
         << "Usage: trackxy <camera_number_or_video_file> <output_filename>\n"
         << "Controls:\n"
         << "\tEsc - Quit\n"
         << "\tr   - Select ROI and re-initialize\n"
         << "\tc   - Clear tracking\n"
         << "\tn   - Toggle night mode\n" << endl;
}

int main(int argc, char** argv) {
    string inputSource;
    string filename;

    help();

    if (argc >= 2) {
        inputSource = argv[1];
    } else {
        cout << "Camera number [0] or video file: ";
        getline(cin, inputSource);
        if (inputSource.empty()) inputSource = "0";
    }

    if (argc >= 3) {
        filename = argv[2];
    } else {
        cout << "Output filename (.csv): ";
        getline(cin, filename);
        if (filename.empty()) filename = "output";
        if (filename.find(".csv") == string::npos) filename += ".csv";
    }

    auto cap_ptr = InputHandler::open(inputSource);
    if (!cap_ptr->isOpened()) {
        cerr << "Error: Could not open " << inputSource << endl;
        return -1;
    }
    cv::VideoCapture& cap = *cap_ptr;

    ofstream outfile(filename);
    if (!outfile.is_open()) {
        cerr << "Error: Could not open " << filename << " for writing" << endl;
        return -1;
    }

    auto now = std::chrono::system_clock::now();
    std::time_t now_time = std::chrono::system_clock::to_time_t(now);
    outfile << "samplenumber, millseconds, x, y, status" << endl;
    outfile << "0, 0, 0, 0, Start: " << std::ctime(&now_time);

    PointTracker tracker;
    Mat frame, gray, display;
    bool nightMode = false;
    int samplenumber = 0;
    auto start_time = std::chrono::steady_clock::now();

    namedWindow("TrackXY", 1);

    for (;;) {
        cap >> frame;
        if (frame.empty()) break;

        frame.copyTo(display);
        cvtColor(frame, gray, COLOR_BGR2GRAY);

        if (nightMode) display = Scalar::all(0);

        if (tracker.isTracking()) {
            tracker.update(gray);
            const auto& points = tracker.getPoints();
            
            for (const auto& pt : points) {
                circle(display, pt, 3, Scalar(0, 255, 0), -1);
            }
            
            if (!points.empty()) {
                // Main tracked point in red
                circle(display, points[0], 3, Scalar(0, 0, 255), -1);
                circle(display, points[0], 10, Scalar(255, 255, 255), 1);
                
                auto current_time = std::chrono::steady_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(current_time - start_time).count();
                
                samplenumber++;
                outfile << samplenumber << "," << elapsed << "," 
                        << points[0].x << "," << points[0].y << ",tracking" << endl;
            }
        }

        imshow("TrackXY", display);

        char c = (char)waitKey(10);
        if (c == 27) break;
        if (c == 'n') nightMode = !nightMode;
        if (c == 'c') tracker.clear();
        if (c == 'r') {
            // Select ROI
            Rect roi = selectROI("TrackXY", frame, false, false);
            if (roi.width > 0 && roi.height > 0) {
                tracker.initializeWithROI(gray, roi);
                start_time = std::chrono::steady_clock::now();
                samplenumber = 0;
            }
        }
    }

    outfile.close();
    return 0;
}
