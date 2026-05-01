/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
 */
#pragma once
#include <opencv2/core.hpp>
#include <string>
#include <iostream>

struct CLIArguments {
    std::string inputSource = "0";
    std::string outputFile = "output.csv";
    std::string calibFile = "calibration.yml";
    bool nightMode = false;
    bool help = false;
};

class CLIParser {
public:
    static CLIArguments parse(int argc, char** argv) {
        const std::string keys =
            "{help h usage ? |      | show help message }"
            "{input i        | 0    | input source (camera index or video file) }"
            "{output o       | output.csv | output CSV file for data logging }"
            "{calibration c  | calibration.yml | calibration file to load/save }"
            "{night n        |      | enable night mode (black background) }"
            ;

        cv::CommandLineParser parser(argc, argv, keys);
        parser.about("TrackXY - Optical Point Tracking and Analysis Tool\n\n"
                     "Keyboard Controls:\n"
                     "  Esc - Quit\n"
                     "  r   - Select ROI and re-initialize\n"
                     "  c   - Clear tracking\n"
                     "  n   - Toggle night mode\n"
                     "  s   - Save calibration to file\n"
                     "  o   - Set origin at current tracking point\n"
                     "  k   - Set scale (pixels to units)\n");

        CLIArguments args;
        if (parser.has("help")) {
            args.help = true;
            parser.printMessage();
            return args;
        }

        args.inputSource = parser.get<std::string>("input");
        args.outputFile = parser.get<std::string>("output");
        args.calibFile = parser.get<std::string>("calibration");
        args.nightMode = parser.has("night");

        if (!parser.check()) {
            parser.printErrors();
        }

        return args;
    }
};
