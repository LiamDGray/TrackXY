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

TEST_CASE("PointTracker basic lifecycle", "[tracker]") {
    PointTracker tracker;
    
    SECTION("Initial state") {
        REQUIRE_FALSE(tracker.isTracking());
        REQUIRE(tracker.getPoints().empty());
    }
    
    SECTION("Auto-initialization") {
        // Create a synthetic image with some features (a white square on black background)
        cv::Mat frame = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::rectangle(frame, cv::Point(40, 40), cv::Point(60, 60), cv::Scalar(255), -1);
        
        tracker.autoInitialize(frame);
        
        // It should find at least the corners of the square
        REQUIRE(tracker.isTracking());
        REQUIRE(tracker.getPoints().size() > 0);
    }
    
    SECTION("ROI-initialization") {
        // Create a synthetic image with two squares
        cv::Mat frame = cv::Mat::zeros(100, 100, CV_8UC1);
        // Square 1 at (10, 10)
        cv::rectangle(frame, cv::Point(10, 10), cv::Point(20, 20), cv::Scalar(255), -1);
        // Square 2 at (70, 70)
        cv::rectangle(frame, cv::Point(70, 70), cv::Point(80, 80), cv::Scalar(255), -1);

        // Initialize only in the second square's ROI
        cv::Rect roi(60, 60, 30, 30);
        tracker.initializeWithROI(frame, roi);

        REQUIRE(tracker.isTracking());
        auto points = tracker.getPoints();
        REQUIRE(points.size() > 0);

        // All points should be within the ROI
        for (const auto& pt : points) {
            REQUIRE(pt.x >= roi.x);
            REQUIRE(pt.x <= roi.x + roi.width);
            REQUIRE(pt.y >= roi.y);
            REQUIRE(pt.y <= roi.y + roi.height);
        }
    }

    SECTION("Update tracking") {
        cv::Mat frame1 = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::rectangle(frame1, cv::Point(40, 40), cv::Point(60, 60), cv::Scalar(255), -1);
        
        tracker.autoInitialize(frame1);
        auto initialPoints = tracker.getPoints();
        
        // Move the square slightly in the next frame
        cv::Mat frame2 = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::rectangle(frame2, cv::Point(42, 42), cv::Point(62, 62), cv::Scalar(255), -1);
        
        tracker.update(frame2);
        
        auto updatedPoints = tracker.getPoints();
        REQUIRE(tracker.isTracking());
        REQUIRE(updatedPoints.size() == initialPoints.size());
        
        // The points should have moved (approximately by 2 pixels)
        for (size_t i = 0; i < updatedPoints.size(); ++i) {
            REQUIRE(updatedPoints[i].x > initialPoints[i].x);
            REQUIRE(updatedPoints[i].y > initialPoints[i].y);
        }
    }
    
    SECTION("Point recovery") {
        cv::Mat frame = cv::Mat::zeros(100, 100, CV_8UC1);
        // Three dots
        cv::circle(frame, cv::Point(20, 20), 2, cv::Scalar(255), -1);
        cv::circle(frame, cv::Point(50, 50), 2, cv::Scalar(255), -1);
        cv::circle(frame, cv::Point(80, 80), 2, cv::Scalar(255), -1);

        tracker.autoInitialize(frame);
        REQUIRE(tracker.getPoints().size() == 3);

        // Next frame: move two dots, remove one, add a new one elsewhere
        cv::Mat frame2 = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::circle(frame2, cv::Point(21, 21), 2, cv::Scalar(255), -1);
        cv::circle(frame2, cv::Point(51, 51), 2, cv::Scalar(255), -1);
        // Dot at 80, 80 is gone.
        // New dot at 70, 70
        cv::circle(frame2, cv::Point(70, 70), 2, cv::Scalar(255), -1);

        tracker.update(frame2);
        // It should still have 3 points because it recovered one
        CHECK(tracker.getPoints().size() == 3);
    }

    SECTION("Clear") {
        cv::Mat frame = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::rectangle(frame, cv::Point(40, 40), cv::Point(60, 60), cv::Scalar(255), -1);
        tracker.autoInitialize(frame);
        
        tracker.clear();
        REQUIRE_FALSE(tracker.isTracking());
        REQUIRE(tracker.getPoints().empty());
    }
}
