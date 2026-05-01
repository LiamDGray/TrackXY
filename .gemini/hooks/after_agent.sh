#!/bin/bash
# AfterAgent hook script for Wiggum loop signaling

# This script runs after every turn.
# It can be used to signal completion to an external driver.
# For now, we just ensure a consistent exit state.

echo "Turn complete. Signalling Wiggum driver."
exit 0
