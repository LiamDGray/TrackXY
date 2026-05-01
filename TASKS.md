# TrackXY Modernization Tasks

This file tracks the progress of the TrackXY modernization. The Wiggum loop driver uses this file to determine the next steps.

## Status: 🏗️ PHASE 1 IN PROGRESS

---

### [x] Phase 0: Infrastructure Setup
- [x] Create `.gemini/settings.json` and `.gemini/hooks/after_agent.sh` for post-turn hooks.
- [x] Create and test `wiggum.sh` driver script.
- [x] Establish project constitution (`GEMINI.md`).
- [x] Initialize `main` branch and initial commit.

### [ ] Phase 1: Modernization & Portability
- [/] Create modernization test suite (catch2 or gtest) to baseline current behavior.
- [x] Implement CMake build system (cross-platform).
- [x] Refactor `TrackX.cpp` to remove `Windows.h` and use `std::chrono`.
- [x] Upgrade to OpenCV 4.x modern C++ API.
- [x] Clean up legacy boilerplate (`stdafx.h`, `targetver.h`).

### [ ] Phase 2: Feature Enhancement
- [ ] Implement ROI selection (Draw bounding box).
- [ ] Add support for video file input.
- [ ] Implement live data visualization overlay.

---

## Instructions for Wiggum Loop
1. Read this file at the start of every turn.
2. Pick the first incomplete task.
3. Execute the task (TDD + Feature Branch).
4. Update this file: mark task as complete, add notes if necessary.
5. Provide a summary of work done.
