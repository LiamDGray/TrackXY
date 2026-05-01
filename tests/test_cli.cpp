#include <catch2/catch_test_macros.hpp>
#include "../src/CLIParser.hpp"

TEST_CASE("CLIParser basic parsing", "[cli]") {
    SECTION("Default values") {
        const char* argv[] = {"trackxy"};
        int argc = 1;
        CLIArguments args = CLIParser::parse(argc, (char**)argv);

        CHECK(args.inputSource == "0");
        CHECK(args.outputFile == "output.csv");
        CHECK(args.calibFile == "calibration.yml");
        CHECK(args.nightMode == false);
    }

    SECTION("Custom input and output") {
        const char* argv[] = {"trackxy", "-i=video.mp4", "-o=data.csv"};
        int argc = 3;
        CLIArguments args = CLIParser::parse(argc, (char**)argv);

        CHECK(args.inputSource == "video.mp4");
        CHECK(args.outputFile == "data.csv");
    }

    SECTION("Night mode flag") {
        const char* argv[] = {"trackxy", "-n"};
        int argc = 2;
        CLIArguments args = CLIParser::parse(argc, (char**)argv);

        CHECK(args.nightMode == true);
    }
}
