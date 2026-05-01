/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
 */
#pragma once

#include <vector>
#include <deque>

/**
 * @brief Analyzes a stream of values to estimate oscillation properties like frequency and amplitude.
 */
class OscillationAnalyzer {
public:
    /**
     * @brief Represents a single data point in the analysis window.
     */
    struct Sample {
        float value;    ///< The value of the sample.
        long long time; ///< The timestamp of the sample in milliseconds.
    };

    /**
     * @brief Represents a zero-crossing point identified in the data stream.
     */
    struct Crossing {
        long long time; ///< Estimated time of the crossing in milliseconds.
        bool rising;    ///< True if it's a rising edge (crossing from negative to positive relative to mean).
    };

    /**
     * @brief Construct a new OscillationAnalyzer object.
     * @param windowSize The maximum number of samples to store for analysis.
     */
    OscillationAnalyzer(size_t windowSize = 500) : maxWindow(windowSize) {}

    /**
     * @brief Add a new sample to the analyzer.
     * @param value The value to analyze (e.g., x-coordinate).
     * @param timestamp_ms The timestamp in milliseconds.
     */
    void addSample(float value, long long timestamp_ms) {
        samples.push_back({value, timestamp_ms});
        if (samples.size() > maxWindow) {
            samples.pop_front();
        }

        updateAnalysis();
    }

    /**
     * @brief Get the estimated frequency in Hz.
     * @return Frequency in Hz, or 0.0 if not enough data.
     */
    float getFrequency() const { return frequency; }

    /**
     * @brief Get the estimated amplitude (peak value relative to mean).
     * @return Amplitude in same units as input values.
     */
    float getAmplitude() const { return amplitude; }

    /**
     * @brief Get the estimated oscillation period.
     * @return Period in seconds.
     */
    float getPeriod() const { return (frequency > 0) ? (1.0f / frequency) : 0.0f; }

    /**
     * @brief Get the detected zero-crossing points in the current window.
     * @return Vector of Crossing structures.
     */
    const std::vector<Crossing>& getCrossings() const { return crossings; }

private:
    /**
     * @brief Performs the core analysis: mean calculation, amplitude estimation, and zero-crossing detection.
     */
    void updateAnalysis() {
        if (samples.size() < 10) return;

        // Calculate mean and amplitude
        float sum = 0;
        float minVal = samples[0].value;
        float maxVal = samples[0].value;
        for (const auto& s : samples) {
            sum += s.value;
            if (s.value < minVal) minVal = s.value;
            if (s.value > maxVal) maxVal = s.value;
        }
        float mean = sum / samples.size();
        amplitude = (maxVal - minVal) / 2.0f;

        // Find zero-crossings (crossing the mean)
        crossings.clear();
        for (size_t i = 1; i < samples.size(); ++i) {
            float v1 = samples[i-1].value - mean;
            float v2 = samples[i].value - mean;
            if (v1 * v2 < 0) { // Sign change
                // Linear interpolation for more precise crossing time
                float t = (0 - v1) / (v2 - v1);
                long long crossingTime = samples[i-1].time + (long long)(t * (samples[i].time - samples[i-1].time));
                crossings.push_back({crossingTime, v2 > v1});
            }
        }

        if (crossings.size() >= 4) {
            // Average time between crossings (half-periods)
            long long totalTime = crossings.back().time - crossings.front().time;
            float avgHalfPeriod = (float)totalTime / (crossings.size() - 1);
            frequency = 1000.0f / (2.0f * avgHalfPeriod);
        } else {
            frequency = 0.0f;
        }
    }

    std::deque<Sample> samples;
    std::vector<Crossing> crossings;
    size_t maxWindow;
    float frequency = 0.0f;
    float amplitude = 0.0f;
};
