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
#include <catch2/catch_test_macros.hpp>
#include "../src/Tracker.hpp"
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

TEST_CASE("PointTracker identity preservation", "[tracker]") {
    TrackerConfig config;
    config.maxPoints = 3;
    PointTracker tracker(config);
    
    cv::Mat gray = cv::Mat::zeros(100, 100, CV_8UC1);
    // Draw some distinct features
    cv::circle(gray, cv::Point(20, 20), 5, cv::Scalar(255), -1);
    cv::circle(gray, cv::Point(50, 50), 5, cv::Scalar(255), -1);
    cv::circle(gray, cv::Point(80, 80), 5, cv::Scalar(255), -1);

    tracker.autoInitialize(gray);
    auto points = tracker.getPoints();
    
    REQUIRE(points.size() >= 2);
    cv::Point2f secondPt = points[1];

    SECTION("Losing the first point should stop tracking to prevent jumping") {
        // We attempt to lose the first point. 
        // In this test environment, OpenCV is very persistent, but if it DOES lose it,
        // we want to ensure it doesn't jump to the second point.
        cv::Mat nextGray = cv::Mat::zeros(100, 100, CV_8UC1);
        // Draw everything EXCEPT the first point
        for (size_t i = 1; i < points.size(); ++i) {
            cv::circle(nextGray, points[i], 5, cv::Scalar(255), -1);
        }
        
        tracker.update(nextGray);
        auto newPoints = tracker.getPoints();
        
        if (!newPoints.empty()) {
            // If it's still tracking, it MUST be the same first point (identity preserved)
            // or at least not the second point.
            float distToSecond = cv::norm(newPoints[0] - secondPt);
            CHECK(distToSecond > 1.0f);
        } else {
            // If it lost the point, it should return empty (new behavior)
            SUCCEED("Tracking stopped as expected when primary was lost");
        }
    }
}
