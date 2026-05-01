# TrackXY Modernized
Track position of a point in webcam or video file, in realtime, using Lucas-Kanade optical flow.
Modernized version of the original TrackXY project (2012).

## Features
- **Modern C++ Architecture**: Uses C++17 and OpenCV 4.x API.
- **Cross-Platform Build System**: CMake-based build.
- **ROI Selection**: Interactive region-of-interest selection for tracking initialization.
- **Video File Support**: Process video files in addition to live webcam feeds.
- **Live Data Visualization**: Real-time overlay of tracking status, coordinates, and analysis.
- **Data Logging**: Robust CSV logging of raw and calibrated coordinates.
- **Unit Calibration**: Mapping of pixel coordinates to real-world units.
- **Oscillation Analysis**: Real-time frequency and period estimation for oscillating motions (e.g., pendulums).

## Build Instructions

### Prerequisites
- C++17 compatible compiler (GCC, Clang, MSVC)
- CMake (>= 3.14)
- OpenCV (>= 4.0)
- Catch2 (automatically downloaded for tests)

### Compilation
```bash
mkdir build
cd build
cmake ..
make
```

### Running Tests
```bash
./unit_tests
```

## Usage
```bash
./trackxy <camera_number_or_video_file> <output_filename.csv>
```

### Controls
- **Esc**: Quit the program.
- **r**: Select a Region of Interest (ROI) and re-initialize tracking.
- **c**: Clear current tracking points.
- **n**: Toggle "night mode" (black background for better contrast).

### Calibration
Currently, calibration is set to 1:1 (pixels). Future versions will include interactive calibration tools.

## Output Format
The program logs data to a CSV file with the following columns:
- `samplenumber`: Sequence number of the sample.
- `milliseconds`: Time elapsed since tracking started.
- `x_px`, `y_px`: Raw pixel coordinates.
- `x_cal`, `y_cal`: Calibrated coordinates (currently same as pixels).
- `status`: Tracking status information.

## License
Original lkdemo.cpp (c) 2000-2006 Intel Corporation (BSD).
Enhancements (c) 2012, 2026 Liam D. Gray.
Released under GNU Affero GPL v3.
