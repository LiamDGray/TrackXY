/*
 * TrackXY: Optical Point Tracking and Analysis Tool
 * Copyright (C) 2012, 2026 Liam D. Gray
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
#include "TrackApp.hpp"
#include "InputHandler.hpp"
#include <opencv2/highgui.hpp>
#include <opencv2/imgproc.hpp>
#include <iostream>

using namespace cv;
using namespace std;

TrackApp::TrackApp() : running(true), samplenumber(0), nightMode(false) {
    start_time = std::chrono::steady_clock::now();
}

TrackApp::~TrackApp() {}

int TrackApp::run(int argc, char** argv) {
    CLIArguments args = CLIParser::parse(argc, argv);
    if (args.help) return 0;

    if (!init(args)) return -1;

    namedWindow("TrackXY", 1);
    cout << "Press 'r' to select ROI and start tracking." << endl;

    while (running) {
        processFrame();
        if (frame.empty()) break;

        char c = (char)waitKey(10);
        handleKey(c);
    }

    return 0;
}

bool TrackApp::init(const CLIArguments& args) {
    string inputSource = args.inputSource;
    string filename = args.outputFile;
    calibFile = args.calibFile;
    nightMode = args.nightMode;

    if (filename.find(".csv") == string::npos) filename += ".csv";

    cap = InputHandler::open(inputSource);
    if (!cap->isOpened()) {
        cerr << "Error: Could not open " << inputSource << endl;
        return false;
    }

    logger = std::make_unique<DataLogger>(filename);
    if (!logger->isOpen()) {
        return false;
    }

    if (calibrator.load(calibFile)) {
        cout << "Loaded calibration from " << calibFile << endl;
    }

    return true;
}

void TrackApp::processFrame() {
    (*cap) >> frame;
    if (frame.empty()) return;

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
            logger->log(samplenumber, elapsed, points[0].x, points[0].y, calPt.x, calPt.y, "tracking");
            dualAnalyzer.addSample(calPt.x, calPt.y, elapsed);
        }
    }

    AnalysisResults results;
    results.freqX = dualAnalyzer.getFreqX();
    results.freqY = dualAnalyzer.getFreqY();
    results.ampX = dualAnalyzer.getAmpX();
    results.ampY = dualAnalyzer.getAmpY();
    results.phaseDiff = dualAnalyzer.getPhaseDifference();

    visualizer.draw(display, tracker.getPoints(), elapsed, samplenumber, calibrator, results);

    imshow("TrackXY", display);
}

void TrackApp::handleKey(char c) {
    if (c == 27) running = false;
    if (c == 'n') nightMode = !nightMode;
    if (c == 'c') tracker.clear();
    if (c == 's') {
        calibrator.save(calibFile);
        cout << "Calibration saved to " << calibFile << endl;
    }
    if (c == 'o') {
        if (tracker.isTracking() && !tracker.getPoints().empty()) {
            calibrator.setOrigin(tracker.getPoints()[0]);
            cout << "Origin set to " << tracker.getPoints()[0] << endl;
        } else {
            cout << "Wait for tracking to start before setting origin." << endl;
        }
    }
    if (c == 'k') {
        float dist_units;
        cout << "Enter real-world distance for 100 pixels: ";
        if (cin >> dist_units) {
            calibrator.setScale(100.0f, dist_units);
            cout << "Scale set: 100 px = " << dist_units << " units" << endl;
        } else {
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            cout << "Invalid input." << endl;
        }
    }
    if (c == 'r') {
        Rect roi = selectROI("TrackXY", frame, false, false);
        if (roi.width > 0 && roi.height > 0) {
            tracker.initializeWithROI(gray, roi);
            start_time = std::chrono::steady_clock::now();
            samplenumber = 0;
        }
    }
}
