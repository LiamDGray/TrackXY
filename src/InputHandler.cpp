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
#include "InputHandler.hpp"
#include <algorithm>
#include <cctype>

std::unique_ptr<cv::VideoCapture> InputHandler::open(const std::string& input) {
    auto cap = std::make_unique<cv::VideoCapture>();
    
    if (input.empty()) {
        cap->open(0); // Default to camera 0
    } else if (std::all_of(input.begin(), input.end(), ::isdigit)) {
        cap->open(std::stoi(input));
    } else {
        cap->open(input);
    }
    
    return cap;
}
