#pragma once

#include <opencv2/core.hpp>
#include <opencv2/video/tracking.hpp>
#include <vector>

/**
 * @brief Encapsulates the Lucas-Kanade optical flow tracking logic.
 */
class PointTracker {
public:
    struct Config {
        int maxPoints = 3;
        cv::Size winSize = cv::Size(31, 31);
        cv::Size subPixWinSize = cv::Size(10, 10);
        cv::TermCriteria termcrit = cv::TermCriteria(cv::TermCriteria::COUNT | cv::TermCriteria::EPS, 20, 0.03);
    };

    explicit PointTracker(Config config = Config());

    /**
     * @brief Automatically detect features to track.
     * @param grayFrame Grayscale image to detect features in.
     */
    void autoInitialize(const cv::Mat& grayFrame);

    /**
     * @brief Update the positions of tracked points.
     * @param grayFrame New grayscale image.
     */
    void update(const cv::Mat& grayFrame);

    /**
     * @brief Get the current tracked points.
     * @return Vector of points. The first point is the primary tracked point.
     */
    const std::vector<cv::Point2f>& getPoints() const { return points; }

    /**
     * @brief Check if we are currently tracking any points.
     */
    bool isTracking() const { return !points.empty(); }

    /**
     * @brief Clear all tracked points.
     */
    void clear();

private:
    Config config;
    cv::Mat prevGray;
    std::vector<cv::Point2f> points;
};
