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

#include <opencv2/core.hpp>
#include <opencv2/video/tracking.hpp>
#include <vector>

/**
 * @brief Configuration for PointTracker.
 */
struct TrackerConfig {
    int maxPoints = 3;
    cv::Size winSize = cv::Size(31, 31);
    cv::Size subPixWinSize = cv::Size(10, 10);
    cv::TermCriteria termcrit = cv::TermCriteria(cv::TermCriteria::COUNT | cv::TermCriteria::EPS, 20, 0.03);
};

/**
 * @brief Encapsulates the Lucas-Kanade optical flow tracking logic.
 */
class PointTracker {
public:
    using Config = TrackerConfig;

    explicit PointTracker(Config config = Config());

    /**
     * @brief Automatically detect features to track.
     * @param grayFrame Grayscale image to detect features in.
     */
    void autoInitialize(const cv::Mat& grayFrame);

    /**
     * @brief Initialize tracking within a specific region of interest.
     * @param grayFrame Grayscale image to detect features in.
     * @param roi The rectangle defining the region of interest.
     */
    void initializeWithROI(const cv::Mat& grayFrame, cv::Rect roi);

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
    cv::Mat mask;
    std::vector<cv::Point2f> points;
};
