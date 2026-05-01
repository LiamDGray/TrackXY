#pragma once

#include <opencv2/core.hpp>

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

private:
    cv::Point2f origin;
    float pixelsPerUnit;
};
