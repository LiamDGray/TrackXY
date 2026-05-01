#!/bin/bash
# wiggum.sh: The Ralph Wiggum Loop Driver
# Philosophy: "Iteration beats perfection."

echo "Starting the Wiggum Loop for TrackXY..."

while true; do
    echo "--- New Iteration ---"
    
    # Check for stop signal
    if [ -f .wiggum_stop ]; then
        echo "Stop signal detected. Exiting loop."
        rm .wiggum_stop
        break
    fi

    # Invoke Gemini CLI with the tasks list
    # The agent is expected to read TASKS.md and proceed.
    gemini -p "$(cat TASKS.md)"
    
    # The AfterAgent hook in .gemini/settings.json will fire
    # but the loop proceeds based on the CLI exit.
    
    # Wait a moment to prevent CPU hammering if things fail fast
    sleep 1
done

echo "Wiggum Loop finished."
