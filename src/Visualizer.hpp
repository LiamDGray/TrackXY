#pragma once

#include "Calibrator.hpp"
#include <vector>

struct AnalysisResults {
    float freqX = 0, freqY = 0;
    float ampX = 0, ampY = 0;
    float phaseDiff = 0;
};

class Visualizer {
public:
    void draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count, const Calibrator& calibrator, const AnalysisResults& analysis = AnalysisResults());
    void setNightMode(bool enabled);

private:
    bool nightMode = false;
};
