#include <opencv2/highgui.hpp>
#include <opencv2/videoio.hpp>
#include <opencv2/imgproc.hpp>
#include <iostream>
#include <chrono>
#include <ctime>
#include <vector>
#include <string>
#include "src/Tracker.hpp"
#include "src/InputHandler.hpp"
#include "src/Visualizer.hpp"
#include "src/DataLogger.hpp"
#include "src/Calibrator.hpp"
#include "src/OscillationAnalyzer.hpp"

using namespace cv;
using namespace std;

void print_help(const char* progName) {
    cout << "\nTrackXY Modernized\n"
         << "Usage: " << progName << " [options]\n\n"
         << "Options:\n"
         << "  -i, --input <src>      Input source (camera index or video file, default: 0)\n"
         << "  -o, --output <file>    Output CSV filename (default: output.csv)\n"
         << "  -c, --calibration <f>  Calibration YAML file (default: calibration.yml)\n"
         << "  -n, --night             Start in night mode\n"
         << "  -h, --help              Show this help message\n\n"
         << "Controls:\n"
         << "  Esc - Quit\n"
         << "  r   - Select ROI and re-initialize\n"
         << "  c   - Clear tracking\n"
         << "  n   - Toggle night mode\n" << endl;
}

int main(int argc, char** argv) {
    string inputSource = "0";
    string filename = "output.csv";
    string calibFile = "calibration.yml";
    bool nightMode = false;

    for (int i = 1; i < argc; ++i) {
        string arg = argv[i];
        if (arg == "-h" || arg == "--help") {
            print_help(argv[0]);
            return 0;
        } else if ((arg == "-i" || arg == "--input") && i + 1 < argc) {
            inputSource = argv[++i];
        } else if ((arg == "-o" || arg == "--output") && i + 1 < argc) {
            filename = argv[++i];
        } else if ((arg == "-c" || arg == "--calibration") && i + 1 < argc) {
            calibFile = argv[++i];
        } else if (arg == "-n" || arg == "--night") {
            nightMode = true;
        } else {
            cerr << "Unknown argument: " << arg << endl;
            print_help(argv[0]);
            return -1;
        }
    }

    if (filename.find(".csv") == string::npos) filename += ".csv";

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
    if (calibrator.load(calibFile)) {
        cout << "Loaded calibration from " << calibFile << endl;
    }
    
    OscillationAnalyzer analyzerX;
    OscillationAnalyzer analyzerY;
    Mat frame, gray, display;
    int samplenumber = 0;
    auto start_time = std::chrono::steady_clock::now();

    namedWindow("TrackXY", 1);
    cout << "Press 'r' to select ROI and start tracking." << endl;

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
