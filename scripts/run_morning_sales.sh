#!/bin/bash
# Run morning scheduled email send for YapMate sales system
# Must be run from /Users/conzo/dev/yapmate

set -e  # Exit on error

# Get absolute paths
YAPMATE_ROOT="/Users/conzo/dev/yapmate"
YAPMATE_LEADS="${YAPMATE_ROOT}/yapmate-leads"
VENV_PYTHON="${YAPMATE_LEADS}/venv/bin/python"
SCRIPT="${YAPMATE_LEADS}/scripts/send_scheduled.py"

# Log file for cron output
LOG_DIR="${YAPMATE_ROOT}/logs"
LOG_FILE="${LOG_DIR}/morning_sales_$(date +%Y%m%d).log"

# Ensure log directory exists
mkdir -p "${LOG_DIR}"

# Change to yapmate-leads directory
cd "${YAPMATE_LEADS}" || {
    echo "ERROR: Failed to cd into ${YAPMATE_LEADS}" >&2
    exit 1
}

# Check venv Python exists
if [ ! -f "${VENV_PYTHON}" ]; then
    echo "ERROR: Python not found at ${VENV_PYTHON}" >&2
    exit 1
fi

# Run the scheduled send (append to log)
"${VENV_PYTHON}" "${SCRIPT}" --window morning >> "${LOG_FILE}" 2>&1

exit 0
