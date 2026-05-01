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
#include "OscillationAnalyzer.hpp"
#include <cmath>
#include <algorithm>
#include <vector>

/**
 * @brief Analyzes dual-axis (XY) oscillation properties, including frequency, amplitude, and phase difference.
 */
class DualAxisAnalyzer {
public:
    /**
     * @brief Construct a new DualAxisAnalyzer object.
     * @param windowSize The number of samples to keep in the moving window for analysis.
     */
    DualAxisAnalyzer(size_t windowSize = 500) : analyzerX(windowSize), analyzerY(windowSize) {}

    /**
     * @brief Add a new (x, y) sample to the analysis window.
     * @param x The calibrated x-coordinate.
     * @param y The calibrated y-coordinate.
     * @param timestamp_ms The timestamp in milliseconds.
     */
    void addSample(float x, float y, long long timestamp_ms) {
        analyzerX.addSample(x, timestamp_ms);
        analyzerY.addSample(y, timestamp_ms);
        updatePhaseAnalysis();
    }

    /** @brief Get the estimated frequency of X-axis oscillations in Hz. */
    float getFreqX() const { return analyzerX.getFrequency(); }
    /** @brief Get the estimated frequency of Y-axis oscillations in Hz. */
    float getFreqY() const { return analyzerY.getFrequency(); }
    /** @brief Get the estimated amplitude of X-axis oscillations. */
    float getAmpX() const { return analyzerX.getAmplitude(); }
    /** @brief Get the estimated amplitude of Y-axis oscillations. */
    float getAmpY() const { return analyzerY.getAmplitude(); }
    
    /**
     * @brief Get the phase difference between Y and X oscillations in degrees.
     * @return Phase difference (Y relative to X) in the range [-180, 180].
     */
    float getPhaseDifference() const { return phaseDifference; }

private:
    /**
     * @brief Internal method to update the phase difference analysis based on zero-crossings.
     */
    void updatePhaseAnalysis() {
        const auto& xCross = analyzerX.getCrossings();
        const auto& yCross = analyzerY.getCrossings();

        if (xCross.size() < 4 || yCross.size() < 4) {
            phaseDifference = 0.0f;
            return;
        }

        float periodX = analyzerX.getPeriod() * 1000.0f; // in ms
        if (periodX <= 0) return;

        float totalPhase = 0;
        int count = 0;

        for (const auto& xCr : xCross) {
            long long closestTy = -1;
            long long minDiff = -1;
            
            for (const auto& yCr : yCross) {
                if (xCr.rising == yCr.rising) {
                    long long diff = std::abs(xCr.time - yCr.time);
                    if (minDiff == -1 || diff < minDiff) {
                        minDiff = diff;
                        closestTy = yCr.time;
                    }
                }
            }

            if (closestTy != -1) {
                float dt = (float)(closestTy - xCr.time);
                float phase = (dt / periodX) * 360.0f;
                
                while (phase > 180.0f) phase -= 360.0f;
                while (phase < -180.0f) phase += 360.0f;
                
                totalPhase += phase;
                count++;
            }
        }

        if (count > 0) {
            phaseDifference = totalPhase / count;
        } else {
            phaseDifference = 0.0f;
        }
    }

    OscillationAnalyzer analyzerX;
    OscillationAnalyzer analyzerY;
    float phaseDifference = 0.0f;
};
