# TrackXY Modernization Tasks

This file tracks the progress of the TrackXY modernization. The Wiggum loop driver uses this file to determine the next steps.

## Status: ✅ PHASE 3 COMPLETE

---

### [x] Phase 0: Infrastructure Setup
- [x] Create `.gemini/settings.json` and `.gemini/hooks/after_agent.sh` for post-turn hooks.
- [x] Create and test `wiggum.sh` driver script.
- [x] Establish project constitution (`GEMINI.md`).
- [x] Initialize `main` branch and initial commit.

### [x] Phase 1: Modernization & Portability
- [x] Create modernization test suite (catch2 or gtest) to baseline current behavior. (Refactored tracking logic into PointTracker class)
- [x] Implement CMake build system (cross-platform).
- [x] Refactor TrackX.cpp to remove Windows.h and use std::chrono.
- [x] Upgrade to OpenCV 4.x modern C++ API.
- [x] Clean up legacy boilerplate (stdafx.h, targetver.h).


### [x] Phase 2: Feature Enhancement
- [x] Implement ROI selection (Draw bounding box).
- [x] Add support for video file input.
- [x] Implement live data visualization overlay.

### [x] Phase 3: Robustness & Calibration
- [x] Implement a dedicated `DataLogger` class for CSV output.
- [x] Add unit calibration (pixels to real-world units).
- [x] Improve "chaperone" point handling.
- [x] Add basic data analysis (peak detection, frequency estimation).

### [ ] Phase 4: Advanced Analysis & UX
- [x] Fix primary point identity (prevent jumping to chaperones).
- [x] Implement dual-axis (XY) oscillation analysis.
- [x] Add support for saving/loading calibration.
- [ ] Improve CLI argument parsing (add flags, better help).

### [ ] Phase 5: Polishing & Documentation
- [ ] Refactor main function into a TrackApp class.
- [ ] Add Doxygen-style documentation to all headers.
- [ ] Update README.md with usage examples and calibration guide.
- [ ] Final code cleanup (remove unused headers, fix linting).

---

## Instructions for Wiggum Loop
1. Read this file at the start of every turn.
2. Pick the first incomplete task.
3. Execute the task (TDD + Feature Branch).
4. Update this file: mark task as complete, add notes if necessary.
5. Provide a summary of work done.
