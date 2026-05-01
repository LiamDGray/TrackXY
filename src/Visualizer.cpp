#include "Visualizer.hpp"
#include <opencv2/imgproc.hpp>
#include <string>
#include <iomanip>
#include <sstream>

void Visualizer::draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count, const Calibrator& calibrator, float freqX, float freqY) {
    if (nightMode) {
        img = cv::Scalar::all(0);
    }

    int fontFace = cv::FONT_HERSHEY_SIMPLEX;
    double fontScale = 0.5;
    int thickness = 1;
    cv::Scalar textColor(255, 255, 255);
    cv::Scalar bgColor(0, 0, 0);

    auto drawTextWithShadow = [&](const std::string& text, cv::Point pos) {
        cv::putText(img, text, pos + cv::Point(1, 1), fontFace, fontScale, bgColor, thickness + 1);
        cv::putText(img, text, pos, fontFace, fontScale, textColor, thickness);
    };

    std::stringstream ss;
    ss << "Sample: " << sample_count;
    drawTextWithShadow(ss.str(), cv::Point(10, 20));

    ss.str("");
    ss << "Time: " << std::fixed << std::setprecision(2) << (elapsed_ms / 1000.0) << "s";
    drawTextWithShadow(ss.str(), cv::Point(10, 40));

    if (!points.empty()) {
        cv::Point2f calPt = calibrator.transform(points[0]);

        ss.str("");
        ss << "X: " << std::fixed << std::setprecision(1) << points[0].x << " (cal: " << calPt.x << ")";
        drawTextWithShadow(ss.str(), cv::Point(10, 60));

        ss.str("");
        ss << "Y: " << std::fixed << std::setprecision(1) << points[0].y << " (cal: " << calPt.y << ")";
        drawTextWithShadow(ss.str(), cv::Point(10, 80));

        int yOffset = 100;
        if (freqX > 0) {
            ss.str("");
            ss << "Freq X: " << std::fixed << std::setprecision(2) << freqX << " Hz";
            drawTextWithShadow(ss.str(), cv::Point(10, yOffset));
            yOffset += 20;
        }
        if (freqY > 0) {
            ss.str("");
            ss << "Freq Y: " << std::fixed << std::setprecision(2) << freqY << " Hz";
            drawTextWithShadow(ss.str(), cv::Point(10, yOffset));
            yOffset += 20;
        }

        if (freqX > 0 || freqY > 0) {
            drawTextWithShadow("Status: TRACKING (OSCILLATING)", cv::Point(10, yOffset));
        } else {
            drawTextWithShadow("Status: TRACKING", cv::Point(10, yOffset));
        }
        
        // Draw crosshair on primary point
        cv::drawMarker(img, points[0], cv::Scalar(0, 0, 255), cv::MARKER_CROSS, 20, 1);
        cv::circle(img, points[0], 10, cv::Scalar(255, 255, 255), 1);
    } else {
        drawTextWithShadow("Status: IDLE", cv::Point(10, 60));
    }
}

void Visualizer::setNightMode(bool enabled) {
    nightMode = enabled;
}
