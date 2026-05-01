#include "Tracker.hpp"
#include <opencv2/imgproc.hpp>

PointTracker::PointTracker(Config cfg) : config(cfg) {}

void PointTracker::autoInitialize(const cv::Mat& grayFrame) {
    cv::goodFeaturesToTrack(grayFrame, points, config.maxPoints, 0.01, 10, cv::Mat(), 3, false, 0.04);
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

    std::vector<cv::Point2f> trackedPoints;
    for (size_t i = 0; i < status.size(); ++i) {
        if (status[i]) {
            trackedPoints.push_back(nextPoints[i]);
        }
    }

    points = std::move(trackedPoints);
    grayFrame.copyTo(prevGray);
}

void PointTracker::clear() {
    points.clear();
    prevGray.release();
}
