#pragma once
#include <opencv2/videoio.hpp>
#include <string>
#include <memory>

class InputHandler {
public:
    static std::unique_ptr<cv::VideoCapture> open(const std::string& input);
};
