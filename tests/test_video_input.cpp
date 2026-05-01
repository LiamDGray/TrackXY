#include <catch2/catch_test_macros.hpp>
#include <opencv2/videoio.hpp>
#include <opencv2/imgproc.hpp>
#include <filesystem>
#include "../src/InputHandler.hpp"

TEST_CASE("InputHandler handles camera indices and file paths", "[input]") {
    SECTION("Camera index (string representing a number)") {
        // We can't easily test opening a camera in CI, but we can test if it tries to open it as an index.
        // Actually, we'll just test the logic if we move it to a helper that returns the type.
    }

    SECTION("Video file path") {
        std::string test_video = "test_input_real.avi";
        {
            cv::Size frame_size(640, 480);
            cv::VideoWriter writer(test_video, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'), 30, frame_size);
            cv::Mat frame = cv::Mat::zeros(frame_size, CV_8UC3);
            writer.write(frame);
        }

        auto cap = InputHandler::open(test_video);
        REQUIRE(cap->isOpened());
        
        std::filesystem::remove(test_video);
    }
}

TEST_CASE("Video file input support", "[video]") {
    std::string test_video = "test_video.avi";
    
    // Cleanup if exists
    if (std::filesystem::exists(test_video)) {
        std::filesystem::remove(test_video);
    }

    SECTION("Create and open a synthetic video file") {
        cv::Size frame_size(640, 480);
        int fps = 30;
        cv::VideoWriter writer(test_video, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'), fps, frame_size);
        
        REQUIRE(writer.isOpened());

        // Write 10 frames
        for (int i = 0; i < 10; ++i) {
            cv::Mat frame = cv::Mat::zeros(frame_size, CV_8UC3);
            cv::putText(frame, "Frame " + std::to_string(i), cv::Point(50, 50), 
                        cv::FONT_HERSHEY_SIMPLEX, 1.0, cv::Scalar(255, 255, 255), 2);
            writer.write(frame);
        }
        writer.release();

        REQUIRE(std::filesystem::exists(test_video));

        // Now try to open it with VideoCapture
        cv::VideoCapture cap(test_video);
        REQUIRE(cap.isOpened());

        cv::Mat frame;
        int count = 0;
        while (cap.read(frame)) {
            REQUIRE_FALSE(frame.empty());
            REQUIRE(frame.size() == frame_size);
            count++;
        }
        REQUIRE(count == 10);
        cap.release();
    }

    // Cleanup
    if (std::filesystem::exists(test_video)) {
        std::filesystem::remove(test_video);
    }
}
