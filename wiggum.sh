#!/bin/bash
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
    gemini --approval-mode=yolo --skip-trust -p "$(cat TASKS.md)"
    
    # Wait a moment to prevent CPU hammering if things fail fast
    sleep 2
done

echo "Wiggum Loop finished."
