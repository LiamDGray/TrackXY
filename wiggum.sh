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
#
# wiggum.sh: The Ralph Wiggum Loop Driver
# Philosophy: "Iteration beats perfection."
#
# Auth tiers (in order of preference):
#   oauth     — Gemini CLI cached OAuth / Code Assist quota (free, generous)
#   aistudio  — Google AI Studio API key quota (free tier, separate bucket)
#   deepseek  — DeepSeek via LiteLLM proxy (paid, requires proxy on :4000)
#
# Prerequisites:
#   - Run with GEMINI_API_KEY and DEEPSEEK_API_KEY already in the environment,
#     e.g.:  set -a; source <(sops --input-type dotenv -d secrets.enc.env); set +a
#   - LiteLLM proxy optionally running: litellm --config config.yaml --port 4000

echo "Starting the Wiggum Loop for TrackXY..."

chmod +x .gemini/hooks/after_agent.sh

# ── Tier state ─────────────────────────────────────────────────────────────────
AUTH_MODE="oauth"
OAUTH_RESET_EPOCH=0
AISTUDIO_RESET_EPOCH=0

# ── Detect available fallback tiers ───────────────────────────────────────────
HAS_AISTUDIO=false
HAS_DEEPSEEK=false

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    HAS_AISTUDIO=true
    echo "AI Studio tier available (GEMINI_API_KEY set)."
else
    echo "Warning: GEMINI_API_KEY not set — AI Studio tier unavailable."
fi

if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
    HAS_DEEPSEEK=true
    echo "DeepSeek tier available (LiteLLM proxy on :4000)."
else
    echo "LiteLLM proxy not running — DeepSeek tier unavailable."
fi

# ── Parse retryDelayMs from quota error output ─────────────────────────────────
parse_retry_delay_sec() {
    local output="$1"
    local pattern='retryDelayMs:[[:space:]]*([0-9.]+)'
    if [[ "$output" =~ $pattern ]]; then
        python3 -c "import math; print(math.ceil(${BASH_REMATCH[1]} / 1000.0))"
    else
        echo "3600"  # fallback: 1 hour
    fi
}

# ── Advance to next available tier on quota exhaustion ────────────────────────
advance_tier() {
    case "$AUTH_MODE" in
        oauth)
            if $HAS_AISTUDIO; then
                AUTH_MODE="aistudio"
                echo "Advancing to AI Studio tier."
            elif $HAS_DEEPSEEK; then
                AUTH_MODE="deepseek"
                echo "Advancing to DeepSeek tier."
            fi
            ;;
        aistudio)
            if $HAS_DEEPSEEK; then
                AUTH_MODE="deepseek"
                echo "Advancing to DeepSeek tier."
            fi
            ;;
        deepseek)
            # All tiers exhausted — handled in main loop
            ;;
    esac
}

# ── Step back up to better tiers if their quotas have reset ───────────────────
maybe_restore_tier() {
    local now
    now=$(date +%s)
    # Always try to restore to the best available tier
    if [[ "$AUTH_MODE" != "oauth" ]] \
        && (( OAUTH_RESET_EPOCH > 0 && now >= OAUTH_RESET_EPOCH )); then
        AUTH_MODE="oauth"
        echo "OAuth quota reset window passed — restoring to OAuth tier."
        return
    fi
    if [[ "$AUTH_MODE" == "deepseek" ]] \
        && $HAS_AISTUDIO \
        && (( AISTUDIO_RESET_EPOCH > 0 && now >= AISTUDIO_RESET_EPOCH )); then
        AUTH_MODE="aistudio"
        echo "AI Studio quota reset window passed — restoring to AI Studio tier."
    fi
}

# ── Invoke gemini with auth appropriate to current tier ───────────────────────
# NOTE: oauth mode unsets GEMINI_API_KEY for the subprocess so cached OAuth
#       tokens take effect. aistudio mode uses the real key directly against
#       Google. deepseek mode uses a dummy key with GOOGLE_GEMINI_BASE_URL to
#       route through LiteLLM — this relies on Gemini CLI honouring
#       GOOGLE_GEMINI_BASE_URL in API key mode, which was unconfirmed in
#       testing; if it doesn't work the loop will sleep on all-tier exhaustion.
gemini_run() {
    local prompt
    prompt="$(cat TASKS.md)"

    case "$AUTH_MODE" in
        oauth)
            # Normal: let Gemini CLI find its cached OAuth tokens
            env -u GEMINI_API_KEY \
                gemini --approval-mode=yolo --skip-trust -p "$prompt" 2>&1
            ;;
        aistudio|deepseek)
            # Hide ~/.gemini/tokens.json by overriding HOME with a temp dir.
            # Without cached OAuth, Gemini CLI falls back to GEMINI_API_KEY.
            # Project-level .gemini/ (CWD) is still found normally.
            local tmpHome
            tmpHome=$(mktemp -d)
            mkdir -p "$tmpHome/.gemini"
            # Copy settings but NOT tokens.json
            cp ~/.gemini/settings.json "$tmpHome/.gemini/" 2>/dev/null || true

            if [[ "$AUTH_MODE" == "aistudio" ]]; then
                HOME="$tmpHome" \
                GEMINI_API_KEY="${GEMINI_API_KEY}" \
                    timeout 30 gemini --approval-mode=yolo --skip-trust -p "$prompt" 2>&1
            else
                # deepseek: dummy key routes to LiteLLM
                HOME="$tmpHome" \
                GEMINI_API_KEY="sk-1234" \
                GOOGLE_GEMINI_BASE_URL="http://localhost:4000" \
                    timeout 30 gemini --approval-mode=yolo --skip-trust -p "$prompt" 2>&1
            fi

            rm -rf "$tmpHome"
            ;;
    esac
}

# ── Main loop ──────────────────────────────────────────────────────────────────
while true; do
    echo "--- New Iteration [mode: $AUTH_MODE] ---"

    # Exit if all tasks are checked off
    if ! grep -qP '^\s*-\s*\[ \]' TASKS.md; then
	echo "All tasks complete. Wiggum is done."
	break
    fi

    if [[ -f .wiggum_stop ]]; then
        echo "Stop signal detected. Exiting."
        rm .wiggum_stop
        break
    fi

    maybe_restore_tier

    OUTPUT=$(gemini_run)
    echo "$OUTPUT"

    if [[ "$OUTPUT" == *"QUOTA_EXHAUSTED"* ]] \
        || [[ "$OUTPUT" == *"TerminalQuotaError"* ]] \
        || [[ "$OUTPUT" == *"quota will reset"* ]]; then

        DELAY_SEC=$(parse_retry_delay_sec "$OUTPUT")
        RESET_EPOCH=$(( $(date +%s) + DELAY_SEC ))
        echo "Quota exhausted on '$AUTH_MODE' tier (resets in ${DELAY_SEC}s)."

        case "$AUTH_MODE" in
            oauth)
                OAUTH_RESET_EPOCH=$RESET_EPOCH
                advance_tier
                ;;
            aistudio)
                AISTUDIO_RESET_EPOCH=$RESET_EPOCH
                advance_tier
                ;;
            deepseek)
                # All tiers exhausted — sleep until the soonest reset
                NOW=$(date +%s)
                SOONEST=$RESET_EPOCH
                (( OAUTH_RESET_EPOCH > NOW && OAUTH_RESET_EPOCH < SOONEST )) \
                    && SOONEST=$OAUTH_RESET_EPOCH
                (( AISTUDIO_RESET_EPOCH > NOW && AISTUDIO_RESET_EPOCH < SOONEST )) \
                    && SOONEST=$AISTUDIO_RESET_EPOCH
                SLEEP_SEC=$(( SOONEST - NOW ))
                echo "All tiers exhausted. Sleeping ${SLEEP_SEC}s..."
                sleep "$SLEEP_SEC"
                AUTH_MODE="oauth"  # maybe_restore_tier will correct if still exhausted
                ;;
        esac
    fi

    sleep 2
done

echo "Wiggum Loop finished."
