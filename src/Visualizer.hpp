/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
 */
#pragma once

#include "Calibrator.hpp"
#include <vector>

/**
 * @brief Structure containing the results of oscillation analysis.
 */
struct AnalysisResults {
    float freqX = 0, freqY = 0; ///< Frequency in Hz for X and Y axes.
    float ampX = 0, ampY = 0;   ///< Amplitude in real-world units for X and Y axes.
    float phaseDiff = 0;        ///< Phase difference between X and Y in degrees.
};

/**
 * @brief Handles the visualization of tracking data and analysis results.
 */
class Visualizer {
public:
    /**
     * @brief Draw tracking markers and information on the image.
     * 
     * @param img The image to draw on.
     * @param points Vector of tracked points.
     * @param elapsed_ms Elapsed time in milliseconds.
     * @param sample_count Current sample number.
     * @param calibrator Reference to the calibrator for unit conversion.
     * @param analysis Results of the oscillation analysis.
     */
    void draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count, const Calibrator& calibrator, const AnalysisResults& analysis = AnalysisResults());
    
    /**
     * @brief Set the visualization mode.
     * @param enabled If true, uses a black background (Night Mode).
     */
    void setNightMode(bool enabled);

private:
    bool nightMode = false;
};
