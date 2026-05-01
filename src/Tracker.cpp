#include "Tracker.hpp"
#include <opencv2/imgproc.hpp>
#include <iostream>

PointTracker::PointTracker(Config cfg) : config(cfg) {}

void PointTracker::autoInitialize(const cv::Mat& grayFrame) {
    mask = cv::Mat();
    cv::goodFeaturesToTrack(grayFrame, points, config.maxPoints, 0.01, 10, mask, 3, false, 0.04);
    if (!points.empty()) {
        cv::cornerSubPix(grayFrame, points, config.subPixWinSize, cv::Size(-1, -1), config.termcrit);
    }
    grayFrame.copyTo(prevGray);
}

void PointTracker::initializeWithROI(const cv::Mat& grayFrame, cv::Rect roi) {
    mask = cv::Mat::zeros(grayFrame.size(), CV_8UC1);
    mask(roi).setTo(255);
    
    cv::goodFeaturesToTrack(grayFrame, points, config.maxPoints, 0.01, 10, mask, 3, false, 0.04);
    if (!points.empty()) {
        cv::cornerSubPix(grayFrame, points, config.subPixWinSize, cv::Size(-1, -1), config.termcrit);
    }
    grayFrame.copyTo(prevGray);
}

void PointTracker::update(const cv::Mat& grayFrame) {
    if (points.empty()) {
        grayFrame.copyTo(prevGray);
        return;
    }

    if (prevGray.empty()) {
        grayFrame.copyTo(prevGray);
        return;
    }

    std::vector<cv::Point2f> nextPoints;
    std::vector<uchar> status;
    std::vector<float> err;

    cv::calcOpticalFlowPyrLK(prevGray, grayFrame, points, nextPoints, status, err, 
                             config.winSize, 3, config.termcrit, 0, 0.001);

    // If we lost the primary point (index 0), we should not allow chaperones to shift into its place.
    // The simplest way to maintain the "first point is primary" contract is to stop tracking 
    // if the primary is lost.
    if (status.empty() || !status[0]) {
        points.clear();
        grayFrame.copyTo(prevGray);
        return;
    }

    std::vector<cv::Point2f> trackedPoints;
    for (size_t i = 0; i < status.size(); ++i) {
        if (status[i]) {
            trackedPoints.push_back(nextPoints[i]);
        }
    }

    // Simple recovery: if we lost some points but still have at least one (the primary),
    // try to find more features to fill the chaperones.
    if (!trackedPoints.empty() && trackedPoints.size() < (size_t)config.maxPoints) {
        std::vector<cv::Point2f> newPoints;
        // Avoid picking points too close to existing ones
        cv::Mat currentMask;
        if (!mask.empty()) {
            mask.copyTo(currentMask);
            for (const auto& pt : trackedPoints) {
                cv::circle(currentMask, pt, 10, cv::Scalar(0), -1);
            }
        }
        
        cv::goodFeaturesToTrack(grayFrame, newPoints, config.maxPoints - trackedPoints.size(), 0.01, 10, currentMask, 3, false, 0.04);
        if (!newPoints.empty()) {
            cv::cornerSubPix(grayFrame, newPoints, config.subPixWinSize, cv::Size(-1, -1), config.termcrit);
            for (const auto& pt : newPoints) {
                trackedPoints.push_back(pt);
            }
        }
    }

    points = std::move(trackedPoints);
    grayFrame.copyTo(prevGray);
}

void PointTracker::clear() {
    points.clear();
    prevGray.release();
    mask.release();
}
