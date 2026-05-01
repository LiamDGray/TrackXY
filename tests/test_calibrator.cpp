#include <catch2/catch_test_macros.hpp>
#include "../src/Calibrator.hpp"
#include <opencv2/core.hpp>
#include <cstdio>
#include <string>

TEST_CASE("Calibrator basic functionality", "[calibrator]") {
    Calibrator calibrator;

    SECTION("Default state (1:1 mapping)") {
        cv::Point2f p(100.0f, 200.0f);
        cv::Point2f p_cal = calibrator.transform(p);
        CHECK(p_cal.x == 100.0f);
        CHECK(p_cal.y == 200.0f);
    }

    SECTION("Simple scale calibration") {
        // 100 pixels = 50 mm
        calibrator.setScale(100.0f, 50.0f);
        
        cv::Point2f p(100.0f, 200.0f);
        cv::Point2f p_cal = calibrator.transform(p);
        CHECK(p_cal.x == 50.0f);
        CHECK(p_cal.y == 100.0f);
    }

    SECTION("Calibration with origin") {
        // Origin at (10, 10), 10 pixels = 1 unit
        calibrator.setOrigin(cv::Point2f(10.0f, 10.0f));
        calibrator.setScale(10.0f, 1.0f);

        cv::Point2f p(20.0f, 30.0f);
        cv::Point2f p_cal = calibrator.transform(p);
        // (20-10)/10 = 1.0
        // (30-10)/10 = 2.0
        CHECK(p_cal.x == 1.0f);
        CHECK(p_cal.y == 2.0f);
    }

    SECTION("Persistence (save/load)") {
        calibrator.setOrigin(cv::Point2f(123.0f, 456.0f));
        calibrator.setScale(100.0f, 2.5f);
        
        std::string filename = "test_cal.yml";
        calibrator.save(filename);
        
        Calibrator other;
        REQUIRE(other.load(filename));
        
        CHECK(other.getOrigin().x == 123.0f);
        CHECK(other.getOrigin().y == 456.0f);
        CHECK(other.getPixelsPerUnit() == 40.0f); // 100 / 2.5
        
        // Cleanup
        std::remove(filename.c_str());
    }
}
