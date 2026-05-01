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
#include "../src/Visualizer.hpp"
#include "../src/Calibrator.hpp"
#include <opencv2/core.hpp>

TEST_CASE("Visualizer basic drawing", "[visualizer]") {
    Visualizer visualizer;
    Calibrator calibrator;
    cv::Mat img = cv::Mat::zeros(480, 640, CV_8UC3);
    std::vector<cv::Point2f> points = { cv::Point2f(100, 100) };

    SECTION("Drawing overlay does not crash") {
        REQUIRE_NOTHROW(visualizer.draw(img, points, 1000, 42, calibrator));
    }

    SECTION("Night mode drawing") {
        visualizer.setNightMode(true);
        REQUIRE_NOTHROW(visualizer.draw(img, points, 1000, 42, calibrator));
    }
}
