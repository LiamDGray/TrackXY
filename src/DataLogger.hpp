/*
 * TrackXY - Optical Point Tracking and Analysis Tool
 * Copyright (c) 2012, 2026 Liam D. Gray
 * Released under GNU Affero GPL v3
 */
#pragma once

#include <string>
#include <fstream>

/**
 * @brief Handles logging of tracking data to a CSV file.
 * 
 * The logger records sequence numbers, timestamps, raw pixel coordinates,
 * and calibrated real-world coordinates for the primary tracked point.
 */
class DataLogger {
public:
    /**
     * @brief Construct a new DataLogger object and opens the output file.
     * @param filename The path to the output CSV file.
     */
    explicit DataLogger(const std::string& filename);

    /**
     * @brief Destroy the DataLogger object, ensuring the file is closed.
     */
    ~DataLogger();

    /**
     * @brief Log a single sample with calibrated values.
     * 
     * @param samplenumber The sequence number of the sample.
     * @param timestamp_ms The timestamp in milliseconds since tracking started.
     * @param x Raw x-coordinate in pixels.
     * @param y Raw y-coordinate in pixels.
     * @param calX Calibrated x-coordinate in real-world units.
     * @param calY Calibrated y-coordinate in real-world units.
     * @param status A status string (e.g., "tracking", "lost").
     */
    void log(int samplenumber, long long timestamp_ms, float x, float y, float calX, float calY, const std::string& status);

    /**
     * @brief Set the unit name for calibrated values (used in header if implemented).
     * @param unitName Name of the units (e.g., "mm", "cm").
     */
    void setUnits(const std::string& unitName) { units = unitName; }

    /**
     * @brief Check if the log file is open and ready for writing.
     * @return true if open, false otherwise.
     */
    bool isOpen() const { return outfile.is_open(); }

private:
    std::ofstream outfile;
    std::string units = "units";
};
