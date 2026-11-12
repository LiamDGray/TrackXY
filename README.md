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
- **Measurement Receipts**: Bind a result CSV to its video, calibration, and parameters so the numbers can be checked later.

## Documentation

| Document | What it covers |
|----------|----------------|
| [docs/technical-report.md](docs/technical-report.md) | Method, assumptions, verification status, limitations, roadmap |
| [docs/architecture.md](docs/architecture.md) | Components, contracts, frame lifecycle, output schema, test strategy |
| [docs/measurement-provenance.md](docs/measurement-provenance.md) | Making a result checkable; composition with [RealPeep](https://github.com/LiamDGray/realpeep) capture attestation |

Start with [docs/README.md](docs/README.md) if you are not sure which one you want.

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

The receipt tool has its own Python suite, which needs no OpenCV:

```bash
python3 -m unittest tests.test_measurement_receipt
```

The C++ suite uses Catch2 (fetched automatically at configure time) and runs eleven cases across
eight files: tracker lifecycle and identity, calibration round-trip, CSV formatting, CLI parsing,
input routing, both analysers, and the visualiser. Nothing in it needs a camera or a display.

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

> **Note on `sample.csv`:** the checked-in file is a 2012 capture and uses the legacy header
> (`samplenumber, millseconds, x, y, numclicks, comments or notes`). It is kept as a historical
> artefact, not as a format reference — the current schema is the one above, written by
> `DataLogger`.

## Measurement receipts

A CSV is a claim, not evidence — anyone can edit a row. Bind it to its inputs before sharing:

```bash
tools/measurement_receipt.py emit \
  --csv output.csv --calibration calibration.yml --video clip.mp4 \
  --out measurement.receipt.json

tools/measurement_receipt.py verify --receipt measurement.receipt.json
```

Verification recomputes every digest, the row chain, and the manifest root, so a modified row, an
appended sample, or a changed calibration is reported rather than accepted. Pass
`--capture-root <hex>` with a RealPeep session root to bind the numbers to an attested capture.
See [docs/measurement-provenance.md](docs/measurement-provenance.md).

## Analysis Capabilities
TrackXY includes real-time oscillation analysis for both X and Y axes:
- **Frequency**: Estimated in Hz using zero-crossing detection.
- **Amplitude**: Half of the peak-to-peak distance in the current analysis window.
- **Phase Difference**: The phase shift between Y and X oscillations (in degrees). Useful for analyzing circular or elliptical motion.

## Development harness (agentic)

The 2026 modernization was carried out by a coding agent running in a loop, and the harness is part
of the repository:

| File | Role |
|------|------|
| `GEMINI.md` | Project constitution: TDD is mandatory, one feature branch per task, C++17/20, modern OpenCV API, CMake only |
| `TASKS.md` | Durable state. The agent reads it every turn, ticks the first unchecked item, and writes a note |
| `wiggum.sh` | Loop driver. Feeds `TASKS.md` to the agent and handles quota exhaustion across three auth tiers |
| `config.yaml` | LiteLLM router used by the paid fallback tier: ordered `pro`/`flash` model chains with per-deployment rate limits |
| `.gemini/settings.json`, `.gemini/hooks/after_agent.sh` | `AfterAgent` hook — the seam where a verifier belongs |

Auth tiers in `wiggum.sh`, best first: cached Gemini CLI OAuth, then a Google AI Studio API key,
then DeepSeek through the local LiteLLM proxy. On a quota error the driver parses the provider's
`retryDelayMs`, parks that tier, advances, and restores the free tiers when their windows pass.
Create a `.wiggum_stop` file to exit cleanly between iterations.

Provider keys are supplied via `sops`-encrypted `secrets.enc.env` and inherited through the
environment — never as command-line arguments.

## License
Original lkdemo.cpp (c) 2000-2006 Intel Corporation (BSD).
Enhancements (c) 2012, 2026 Liam D. Gray.
Released under GNU Affero GPL v3.
