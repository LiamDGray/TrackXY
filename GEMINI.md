# TrackXY Project Constitution

This document defines the foundational engineering standards and workflows for the TrackXY project. Adherence to these mandates ensures high code quality, maintainability, and a professional portfolio-grade codebase.

## Core Mandates

### 1. Test-Driven Development (TDD)
- **Rule:** No production code shall be written without a corresponding failing test.
- **Workflow:**
    1. Write a test that reproduces a bug or defines a new feature.
    2. Run the test to confirm it fails.
    3. Write the minimal code required to pass the test.
    4. Refactor while ensuring tests remain green.

### 2. Feature Branch Discipline
- **Rule:** Every task or feature must be developed in a dedicated branch.
- **Workflow:**
    1. Create a new branch from `main` (e.g., `feature/modernize-timing`).
    2. Implement changes and verify with tests.
    3. Merge back to `main` only when the task is complete and verified.
    4. Delete the feature branch after merging.

### 3. The Ralph Wiggum Loop (Autonomous Development)
- **Philosophy:** "Iteration beats perfection."
- **Execution:** The agent operates autonomously via a driver script (`wiggum.sh`) that repeatedly feeds it the current state from `TASKS.md`.
- **Constraint:** The agent must update `TASKS.md` at the end of every turn to persist progress and signal next steps.
- **Completion:** The loop continues until all tasks are marked complete or a stopping condition is met.

### 4. Technical Standards
- **Standard:** Modern C++17/20.
- **API:** Prefer the modern OpenCV 4.x C++ API over legacy C-style functions.
- **Portability:** Strictly avoid platform-specific APIs (e.g., `Windows.h`) in core logic. Use `std::chrono` for timing and `std::filesystem` for file operations.
- **Build System:** CMake is the sole supported build system.

## Communication
- Keep logs and commit messages concise and high-signal.
- Focus on "why" changes were made, not just "what" changed.
