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

#include <opencv2/core.hpp>
#include <string>

/**
 * @brief Handles conversion between pixel coordinates and real-world units.
 */
class Calibrator {
public:
    Calibrator() : origin(0, 0), pixelsPerUnit(1.0f) {}

    /**
     * @brief Set the calibration scale.
     * @param pixels Number of pixels.
     * @param units Corresponding number of real-world units.
     */
    void setScale(float pixels, float units) {
        if (pixels != 0) {
            pixelsPerUnit = pixels / units;
        }
    }

    /**
     * @brief Set the origin point in pixel coordinates.
     * @param p The origin point.
     */
    void setOrigin(cv::Point2f p) {
        origin = p;
    }

    /**
     * @brief Transform a pixel coordinate to real-world units.
     * @param p The pixel coordinate.
     * @return The coordinate in real-world units.
     */
    cv::Point2f transform(cv::Point2f p) const {
        return (p - origin) * (1.0f / pixelsPerUnit);
    }

    /**
     * @brief Get the scale factor (pixels per unit).
     */
    float getPixelsPerUnit() const { return pixelsPerUnit; }

    /**
     * @brief Get the origin in pixel coordinates.
     */
    cv::Point2f getOrigin() const { return origin; }

    /**
     * @brief Save calibration to a file.
     * @param filename Path to the file.
     */
    void save(const std::string& filename) const {
        cv::FileStorage fs(filename, cv::FileStorage::WRITE);
        if (fs.isOpened()) {
            fs << "origin" << origin;
            fs << "pixelsPerUnit" << pixelsPerUnit;
        }
    }

    /**
     * @brief Load calibration from a file.
     * @param filename Path to the file.
     * @return true if successful, false otherwise.
     */
    bool load(const std::string& filename) {
        cv::FileStorage fs(filename, cv::FileStorage::READ);
        if (!fs.isOpened()) return false;
        fs["origin"] >> origin;
        fs["pixelsPerUnit"] >> pixelsPerUnit;
        return true;
    }

private:
    cv::Point2f origin;
    float pixelsPerUnit;
};
