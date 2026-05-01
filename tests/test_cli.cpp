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
