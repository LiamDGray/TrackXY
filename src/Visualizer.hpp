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
