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
