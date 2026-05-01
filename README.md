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
- **Dual-Axis Oscillation Analysis**: Real-time frequency, amplitude, and phase difference estimation for XY oscillations.

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
cd build
ctest
```

## Usage
```bash
./trackxy [options]
```

### Command Line Options
- `-i`, `--input`: Input source (camera index e.g., `0`, or path to a video file). Default: `0`.
- `-o`, `--output`: Output CSV file for data logging. Default: `output.csv`.
- `-c`, `--calibration`: Calibration file to load/save. Default: `calibration.yml`.
- `-n`, `--night`: Enable night mode (black background for better contrast).
- `-h`, `--help`: Show help message.

### Keyboard Controls
- **Esc**: Quit the program.
- **r**: Select a Region of Interest (ROI) and re-initialize tracking.
  - *Click and drag to draw a box around the feature you want to track, then press Enter.*
- **c**: Clear current tracking points.
- **n**: Toggle "night mode".
- **s**: Save current calibration (origin and scale) to the calibration file.
- **o**: Set the coordinate system origin (0,0) at the current primary tracking point.
- **k**: Set the scale. You will be prompted in the console to enter the real-world distance that corresponds to 100 pixels in the image.

### Calibration Guide
1. **Find a reference**: Place an object of known length in the camera view at the same depth as the tracked object.
2. **Measure pixels**: (Optional) If you know your camera's pixels-per-mm, you can use that. Otherwise:
3. **Use 'k'**: Press 'k' and enter the distance (e.g., `50.0` for 50mm) that corresponds to 100 pixels.
4. **Set Origin**: Move the tracking point to your desired (0,0) location and press 'o'.
5. **Save**: Press 's' to save these settings to `calibration.yml`. They will be loaded automatically next time you run TrackXY with the same calibration file flag.

## Output Format
The program logs data to a CSV file with the following columns:
- `samplenumber`: Sequence number of the sample.
- `milliseconds`: Time elapsed since tracking started.
- `x_px`, `y_px`: Raw pixel coordinates.
- `x_cal`, `y_cal`: Calibrated coordinates in your chosen units.
- `status`: Tracking status information.

## Analysis Capabilities
TrackXY includes real-time oscillation analysis for both X and Y axes:
- **Frequency**: Estimated in Hz using zero-crossing detection.
- **Amplitude**: Half of the peak-to-peak distance in the current analysis window.
- **Phase Difference**: The phase shift between Y and X oscillations (in degrees). Useful for analyzing circular or elliptical motion.

## License
Original lkdemo.cpp (c) 2000-2006 Intel Corporation (BSD).
Enhancements (c) 2012, 2026 Liam D. Gray.
Released under GNU Affero GPL v3.
