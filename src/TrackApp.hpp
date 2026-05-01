/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
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
