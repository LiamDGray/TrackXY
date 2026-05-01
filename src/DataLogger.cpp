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
#include "DataLogger.hpp"
#include <chrono>
#include <ctime>
#include <iostream>
#include <iomanip>

DataLogger::DataLogger(const std::string& filename) : outfile(filename) {
    if (outfile.is_open()) {
        auto now = std::chrono::system_clock::now();
        std::time_t now_time = std::chrono::system_clock::to_time_t(now);
        
        outfile << "samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status" << std::endl;
        outfile << "0, 0, 0, 0, 0, 0, Start: " << std::put_time(std::localtime(&now_time), "%Y-%m-%d %H:%M:%S") << std::endl;
    } else {
        std::cerr << "Error: Could not open " << filename << " for writing" << std::endl;
    }
}

DataLogger::~DataLogger() {
    if (outfile.is_open()) {
        outfile.close();
    }
}

void DataLogger::log(int samplenumber, long long timestamp_ms, float x, float y, float calX, float calY, const std::string& status) {
    if (outfile.is_open()) {
        outfile << samplenumber << "," << timestamp_ms << "," 
                << x << "," << y << "," 
                << calX << "," << calY << "," 
                << status << std::endl;
    }
}
