#pragma once

#include <string>
#include <fstream>

/**
 * @brief Handles logging of tracking data to a CSV file.
 */
class DataLogger {
public:
    /**
     * @brief Construct a new DataLogger object.
     * @param filename The path to the output CSV file.
     */
    explicit DataLogger(const std::string& filename);

    /**
     * @brief Destroy the DataLogger object, closing the file.
     */
    ~DataLogger();

    /**
     * @brief Log a single sample with calibrated values.
     * @param samplenumber The sequence number of the sample.
     * @param timestamp_ms The timestamp in milliseconds.
     * @param x Raw x-coordinate in pixels.
     * @param y Raw y-coordinate in pixels.
     * @param calX Calibrated x-coordinate.
     * @param calY Calibrated y-coordinate.
     * @param status A status string.
     */
    void log(int samplenumber, long long timestamp_ms, float x, float y, float calX, float calY, const std::string& status);

    /**
     * @brief Set the unit name for calibrated values.
     */
    void setUnits(const std::string& unitName) { units = unitName; }

    /**
     * @brief Check if the log file is open and ready.
     */
    bool isOpen() const { return outfile.is_open(); }

private:
    std::ofstream outfile;
    std::string units = "units";
};
