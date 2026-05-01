cmake_minimum_required(VERSION 3.14)
project(TrackXY VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find OpenCV
find_package(OpenCV REQUIRED)
include_directories(${OpenCV_INCLUDE_DIRS})

# Catch2 for testing
include(FetchContent)
FetchContent_Declare(
  Catch2
  GIT_REPOSITORY https://github.com/catchorg/Catch2.git
  GIT_TAG v3.4.0 # Or a specific version
)
FetchContent_MakeAvailable(Catch2)

# Source files (we'll add more as we refactor)
# For now, let's try to compile a placeholder or the main file after some minimal fixes
add_executable(trackxy TrackX.cpp lkdemo.cpp)
target_link_libraries(trackxy PRIVATE ${OpenCV_LIBS})

# Tests
enable_testing()
add_executable(unit_tests tests/test_main.cpp)
target_link_libraries(unit_tests PRIVATE Catch2::Catch2WithMain ${OpenCV_LIBS})

include(CTest)
add_test(NAME unit_tests COMMAND unit_tests)
