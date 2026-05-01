#include "InputHandler.hpp"
#include <algorithm>
#include <cctype>

std::unique_ptr<cv::VideoCapture> InputHandler::open(const std::string& input) {
    auto cap = std::make_unique<cv::VideoCapture>();
    
    if (input.empty()) {
        cap->open(0); // Default to camera 0
    } else if (std::all_of(input.begin(), input.end(), ::isdigit)) {
        cap->open(std::stoi(input));
    } else {
        cap->open(input);
    }
    
    return cap;
}
