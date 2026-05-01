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
#include <catch2/catch_approx.hpp>
#include "../src/OscillationAnalyzer.hpp"
#include <cmath>
#include <vector>

TEST_CASE("OscillationAnalyzer basic estimation", "[analyzer]") {
    OscillationAnalyzer analyzer;

    SECTION("Static signal should have zero frequency") {
        for (int i = 0; i < 100; ++i) {
            analyzer.addSample(10.0f, i * 10); // 100Hz sampling
        }
        CHECK(analyzer.getFrequency() == 0.0f);
    }

    SECTION("Sine wave frequency estimation") {
        float freq = 2.0f; // 2 Hz
        float amplitude = 10.0f;
        float dt = 0.01f; // 100 Hz sampling
        
        for (int i = 0; i < 500; ++i) { // 5 seconds of data
            float t = i * dt;
            float val = amplitude * std::sin(2.0f * M_PI * freq * t);
            analyzer.addSample(val, (long long)(t * 1000));
        }

        // We expect it to be close to 2.0 Hz
        CHECK(analyzer.getFrequency() == Catch::Approx(2.0f).margin(0.1));
    }
}

TEST_CASE("OscillationAnalyzer advanced features", "[analyzer]") {
    OscillationAnalyzer analyzer;

    SECTION("Amplitude estimation") {
        float freq = 2.0f;
        float amplitude = 15.0f;
        float dt = 0.01f;
        
        for (int i = 0; i < 500; ++i) { // 5 seconds of data
            float t = i * dt;
            float val = amplitude * std::sin(2.0f * M_PI * freq * t);
            analyzer.addSample(val, (long long)(t * 1000));
        }

        // We expect amplitude to be around 15.0
        CHECK(analyzer.getAmplitude() == Catch::Approx(15.0f).margin(1.0));
    }
}

#include "../src/DualAxisAnalyzer.hpp"

TEST_CASE("DualAxisAnalyzer phase estimation", "[dual-analyzer]") {
    DualAxisAnalyzer analyzer;

    SECTION("90 degree phase difference (Circular)") {
        float freq = 2.0f; // 2 Hz
        float amplitude = 10.0f;
        float dt = 0.01f; // 100 Hz sampling
        
        for (int i = 0; i < 500; ++i) {
            float t = i * dt;
            float x = amplitude * std::cos(2.0f * M_PI * freq * t);
            float y = amplitude * std::sin(2.0f * M_PI * freq * t); // sin is cos - 90 deg
            analyzer.addSample(x, y, (long long)(t * 1000));
        }

        // Phase difference should be around 90 degrees
        CHECK(std::abs(analyzer.getPhaseDifference()) == Catch::Approx(90.0f).margin(10.0));
    }

    SECTION("0 degree phase difference (Linear)") {
        float freq = 2.0f;
        float amplitude = 10.0f;
        float dt = 0.01f;
        
        for (int i = 0; i < 500; ++i) {
            float t = i * dt;
            float x = amplitude * std::sin(2.0f * M_PI * freq * t);
            float y = amplitude * std::sin(2.0f * M_PI * freq * t);
            analyzer.addSample(x, y, (long long)(t * 1000));
        }

        CHECK(std::abs(analyzer.getPhaseDifference()) == Catch::Approx(0.0f).margin(10.0));
    }
}
