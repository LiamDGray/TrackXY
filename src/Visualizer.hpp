#pragma once

#include <opencv2/core.hpp>
#include <vector>

class Visualizer {
public:
    void draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count);
    void setNightMode(bool enabled);

private:
    bool nightMode = false;
};
