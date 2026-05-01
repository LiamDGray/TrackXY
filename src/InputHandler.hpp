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
