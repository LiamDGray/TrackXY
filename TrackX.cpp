#include <opencv2/highgui.hpp>
#include <opencv2/videoio.hpp>
#include <opencv2/imgproc.hpp>
#include <iostream>
#include <chrono>
#include <ctime>
#include "src/Tracker.hpp"
#include "src/InputHandler.hpp"
#include "src/Visualizer.hpp"
#include "src/DataLogger.hpp"
#include "src/Calibrator.hpp"
#include "src/OscillationAnalyzer.hpp"

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

    DataLogger logger(filename);
    if (!logger.isOpen()) {
        return -1;
    }

    PointTracker tracker;
    Visualizer visualizer;
    Calibrator calibrator;
    OscillationAnalyzer analyzerX;
    OscillationAnalyzer analyzerY;
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

        visualizer.setNightMode(nightMode);

        long long elapsed = 0;
        if (tracker.isTracking()) {
            tracker.update(gray);
            const auto& points = tracker.getPoints();
            
            if (!points.empty()) {
                auto current_time = std::chrono::steady_clock::now();
                elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(current_time - start_time).count();
                
                samplenumber++;
                cv::Point2f calPt = calibrator.transform(points[0]);
                logger.log(samplenumber, elapsed, points[0].x, points[0].y, calPt.x, calPt.y, "tracking");
                analyzerX.addSample(calPt.x, elapsed);
                analyzerY.addSample(calPt.y, elapsed);
            }
        }

        visualizer.draw(display, tracker.getPoints(), elapsed, samplenumber, calibrator, analyzerX.getFrequency(), analyzerY.getFrequency());

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

    return 0;
}
