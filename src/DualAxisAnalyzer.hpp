/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
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
