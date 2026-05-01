#include <catch2/catch_test_macros.hpp>
#include "../src/Visualizer.hpp"
#include <opencv2/core.hpp>

TEST_CASE("Visualizer basic drawing", "[visualizer]") {
    Visualizer visualizer;
    cv::Mat img = cv::Mat::zeros(480, 640, CV_8UC3);
    std::vector<cv::Point2f> points = { cv::Point2f(100, 100) };
    
    SECTION("Drawing overlay does not crash") {
        REQUIRE_NOTHROW(visualizer.draw(img, points, 1000, 42));
    }

    SECTION("Night mode drawing") {
        visualizer.setNightMode(true);
        REQUIRE_NOTHROW(visualizer.draw(img, points, 1000, 42));
    }
}
