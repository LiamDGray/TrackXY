# TrackXY: Optical Point Tracking and Analysis Tool
# Copyright (C) 2012, 2026 Liam D. Gray
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
cmake_minimum_required(VERSION 3.14)
project(TrackXY VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenCV
find_package(OpenCV REQUIRED)
include_directories(${OpenCV_INCLUDE_DIRS} src)

# Catch2 for testing
include(FetchContent)
FetchContent_Declare(
  Catch2
  GIT_REPOSITORY https://github.com/catchorg/Catch2.git
  GIT_TAG v3.4.0 # Or a specific version
)
FetchContent_MakeAvailable(Catch2)

# Source files
add_executable(trackxy 
    TrackX.cpp 
    src/Tracker.cpp 
    src/InputHandler.cpp 
    src/Visualizer.cpp
    src/DataLogger.cpp
    src/TrackApp.cpp
)
target_link_libraries(trackxy PRIVATE ${OpenCV_LIBS})

# Tests
enable_testing()
add_executable(unit_tests 
    tests/test_main.cpp 
    tests/test_video_input.cpp 
    tests/test_visualizer.cpp
    tests/test_logger.cpp
    tests/test_calibrator.cpp
    tests/test_analyzer.cpp
    tests/test_tracker.cpp
    tests/test_cli.cpp
    src/Tracker.cpp 
    src/InputHandler.cpp
    src/Visualizer.cpp
    src/DataLogger.cpp
    src/TrackApp.cpp
)
target_link_libraries(unit_tests PRIVATE Catch2::Catch2WithMain ${OpenCV_LIBS})

include(CTest)
add_test(NAME unit_tests COMMAND unit_tests)
