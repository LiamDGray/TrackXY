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
#pragma once

#include <string>
#include <memory>
#include <chrono>
#include <opencv2/videoio.hpp>
#include "CLIParser.hpp"
#include "Tracker.hpp"
#include "Visualizer.hpp"
#include "DataLogger.hpp"
#include "Calibrator.hpp"
#include "DualAxisAnalyzer.hpp"

/**
 * @brief The main application class for TrackXY.
 * 
 * This class encapsulates the application lifecycle, including initialization,
 * the main processing loop, and user input handling.
 */
class TrackApp {
public:
    TrackApp();
    ~TrackApp();

    /**
     * @brief Executes the application.
     * 
     * @param argc Command line argument count.
     * @param argv Command line argument values.
     * @return int Return code (0 for success, non-zero for failure).
     */
    int run(int argc, char** argv);

private:
    /**
     * @brief Initializes application components based on command line arguments.
     * @param args Parsed command line arguments.
     * @return true if initialization succeeded, false otherwise.
     */
    bool init(const CLIArguments& args);

    /**
     * @brief Processes keyboard input.
     * @param c The character code of the key pressed.
     */
    void handleKey(char c);

    /**
     * @brief Processes a single frame from the input source.
     */
    void processFrame();

    std::unique_ptr<cv::VideoCapture> cap;
    std::unique_ptr<DataLogger> logger;
    PointTracker tracker;
    Visualizer visualizer;
    Calibrator calibrator;
    DualAxisAnalyzer dualAnalyzer;

    std::string calibFile;
    bool nightMode = false;
    int samplenumber = 0;
    std::chrono::steady_clock::time_point start_time;
    
    cv::Mat frame, gray, display;
    bool running = true;
};
