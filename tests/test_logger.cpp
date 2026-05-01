#include <catch2/catch_test_macros.hpp>
#include "../src/DataLogger.hpp"
#include <fstream>
#include <filesystem>
#include <vector>
#include <string>

TEST_CASE("DataLogger basic functionality", "[logger]") {
    std::string test_file = "test_log.csv";
    if (std::filesystem::exists(test_file)) {
        std::filesystem::remove(test_file);
    }

    SECTION("Create and log samples") {
        {
            DataLogger logger(test_file);
            logger.log(1, 100, 10.5f, 20.7f, 1.05f, 2.07f, "tracking");
            logger.log(2, 200, 11.0f, 21.2f, 1.10f, 2.12f, "tracking");
        } // logger closes file on destruction

        REQUIRE(std::filesystem::exists(test_file));

        std::ifstream infile(test_file);
        std::string line;
        std::vector<std::string> lines;
        while (std::getline(infile, line)) {
            lines.push_back(line);
        }

        REQUIRE(lines.size() >= 3); // header + metadata + 2 samples
        // Check header (exact format depends on implementation, but should contain these)
        CHECK(lines[0].find("samplenumber") != std::string::npos);
        CHECK(lines[2].find("1,100,10.5,20.7,1.05,2.07,tracking") != std::string::npos);
        CHECK(lines[3].find("2,200,11,21.2,1.1,2.12,tracking") != std::string::npos);
    }

    if (std::filesystem::exists(test_file)) {
        std::filesystem::remove(test_file);
    }
}
