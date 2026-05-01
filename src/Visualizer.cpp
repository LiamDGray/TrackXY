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
#include "Visualizer.hpp"
#include <opencv2/imgproc.hpp>
#include <string>
#include <iomanip>
#include <sstream>

void Visualizer::draw(cv::Mat& img, const std::vector<cv::Point2f>& points, long long elapsed_ms, int sample_count, const Calibrator& calibrator, const AnalysisResults& analysis) {
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
        if (analysis.freqX > 0) {
            ss.str("");
            ss << "Freq X: " << std::fixed << std::setprecision(2) << analysis.freqX << " Hz (Amp: " << analysis.ampX << ")";
            drawTextWithShadow(ss.str(), cv::Point(10, yOffset));
            yOffset += 20;
        }
        if (analysis.freqY > 0) {
            ss.str("");
            ss << "Freq Y: " << std::fixed << std::setprecision(2) << analysis.freqY << " Hz (Amp: " << analysis.ampY << ")";
            drawTextWithShadow(ss.str(), cv::Point(10, yOffset));
            yOffset += 20;
        }

        if (analysis.freqX > 0 && analysis.freqY > 0) {
            ss.str("");
            ss << "Phase Diff: " << std::fixed << std::setprecision(1) << analysis.phaseDiff << " deg";
            drawTextWithShadow(ss.str(), cv::Point(10, yOffset));
            yOffset += 20;
        }

        if (analysis.freqX > 0 || analysis.freqY > 0) {
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
