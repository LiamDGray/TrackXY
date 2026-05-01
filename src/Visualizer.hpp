#pragma once

#include "Calibrator.hpp"
#include <vector>

class Visualizer {
public:
    void draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count, const Calibrator& calibrator, float frequency = 0.0f);
    void setNightMode(bool enabled);

private:
    bool nightMode = false;
};
