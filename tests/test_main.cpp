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
    
    SECTION("Clear") {
        cv::Mat frame = cv::Mat::zeros(100, 100, CV_8UC1);
        cv::rectangle(frame, cv::Point(40, 40), cv::Point(60, 60), cv::Scalar(255), -1);
        tracker.autoInitialize(frame);
        
        tracker.clear();
        REQUIRE_FALSE(tracker.isTracking());
        REQUIRE(tracker.getPoints().empty());
    }
}
