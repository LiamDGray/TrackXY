/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
 */
#pragma once
#include <opencv2/videoio.hpp>
#include <string>
#include <memory>

/**
 * @brief Static utility class for opening video input sources.
 */
class InputHandler {
public:
    /**
     * @brief Open a video capture source.
     * 
     * @param input A string representing either a camera index (e.g., "0") or a path to a video file.
     * @return std::unique_ptr<cv::VideoCapture> A pointer to the opened VideoCapture object.
     */
    static std::unique_ptr<cv::VideoCapture> open(const std::string& input);
};
