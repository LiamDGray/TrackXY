#pragma once
#include "OscillationAnalyzer.hpp"
#include <cmath>
#include <algorithm>
#include <vector>

/**
 * @brief Analyzes dual-axis (XY) oscillation properties.
 */
class DualAxisAnalyzer {
public:
    DualAxisAnalyzer(size_t windowSize = 500) : analyzerX(windowSize), analyzerY(windowSize) {}

    /**
     * @brief Add a new (x, y) sample.
     */
    void addSample(float x, float y, long long timestamp_ms) {
        analyzerX.addSample(x, timestamp_ms);
        analyzerY.addSample(y, timestamp_ms);
        updatePhaseAnalysis();
    }

    float getFreqX() const { return analyzerX.getFrequency(); }
    float getFreqY() const { return analyzerY.getFrequency(); }
    float getAmpX() const { return analyzerX.getAmplitude(); }
    float getAmpY() const { return analyzerY.getAmplitude(); }
    
    /**
     * @brief Get phase difference in degrees (Y relative to X).
     */
    float getPhaseDifference() const { return phaseDifference; }

private:
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
