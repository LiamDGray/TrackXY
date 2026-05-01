#!/bin/bash
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
# wiggum.sh: The Ralph Wiggum Loop Driver
# Philosophy: "Iteration beats perfection."

echo "Starting the Wiggum Loop for TrackXY..."

# Ensure the hook script is executable
chmod +x .gemini/hooks/after_agent.sh

while true; do
    echo "--- New Iteration ---"
    
    # Check for stop signal
    if [ -f .wiggum_stop ]; then
        echo "Stop signal detected. Exiting loop."
        rm .wiggum_stop
        break
    fi

    # Invoke Gemini CLI with the tasks list
    # --approval-mode=yolo: Allow autonomous tool execution
    # --skip-trust: Bypass interactive trust checks
    # Run Gemini and capture both stdout and stderr
    OUTPUT=$(gemini --approval-mode=yolo --skip-trust -p "$(cat TASKS.md)" 2>&1)
    echo "$OUTPUT"
    
    # Check if we hit the quota limit
    if [[ "$OUTPUT" == *"QUOTA_EXHAUSTED"* ]]; then
        # Parse retryDelayMs from the output using bash regex
        pattern='retryDelayMs:[[:space:]]*([0-9.]+)'
        if [[ "$OUTPUT" =~ $pattern ]]; then
            DELAY_MS="${BASH_REMATCH[1]}"
            # Convert ms to seconds and round up using python
            DELAY_SEC=$(python3 -c "import math; print(math.ceil($DELAY_MS / 1000.0))")
            echo "Quota exhausted! Pausing for $DELAY_SEC seconds (from retryDelayMs)..."
            sleep "$DELAY_SEC"
        else
            echo "Quota exhausted, but no retryDelayMs found. Pausing for 60 seconds..."
            sleep 60
        fi
    else
        # Wait a moment to prevent CPU hammering if things fail fast
        sleep 2
    fi
done

echo "Wiggum Loop finished."
