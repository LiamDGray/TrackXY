#include "DataLogger.hpp"
#include <chrono>
#include <ctime>
#include <iostream>

DataLogger::DataLogger(const std::string& filename) : outfile(filename) {
    if (outfile.is_open()) {
        auto now = std::chrono::system_clock::now();
        std::time_t now_time = std::chrono::system_clock::to_time_t(now);
        outfile << "samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status" << std::endl;
        outfile << "0, 0, 0, 0, 0, 0, Start: " << std::ctime(&now_time);
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
