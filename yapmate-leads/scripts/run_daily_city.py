"""Daily city rotation for lead generation."""

import os
import sys
import subprocess
from datetime import date
from pathlib import Path

# Add parent directory to path
script_dir = Path(__file__).parent
project_dir = script_dir.parent
sys.path.insert(0, str(project_dir))

# Static city rotation list
CITIES = [
    "Glasgow",
    "Manchester",
    "Newcastle",
    "Leeds",
    "Liverpool",
    "Birmingham",
    "Nottingham",
    "Sheffield",
    "Bristol",
    "Cardiff",
    "London",
]

# Start date for rotation (day 0 = Glasgow)
START_DATE = date(2026, 1, 17)

# Default settings
DEFAULT_TRADE = "Plumber"
DEFAULT_MAX_LEADS = 20


def get_todays_city() -> str:
    """Get city for today based on deterministic rotation."""
    today = date.today()
    days_since_start = (today - START_DATE).days
    city_index = days_since_start % len(CITIES)
    return CITIES[city_index]


def main():
    """Run lead generation for today's city."""
    today = date.today()
    city = get_todays_city()
    trade = DEFAULT_TRADE
    max_leads = DEFAULT_MAX_LEADS

    print("=" * 80)
    print("DAILY CITY ROTATION")
    print("=" * 80)
    print(f"   Date: {today}")
    print(f"   City: {city}")
    print(f"   Trade: {trade}")
    print(f"   Max leads: {max_leads}")
    print("=" * 80)
    print(flush=True)

    # Change to project directory for correct credential paths
    os.chdir(project_dir)

    # Call existing lead generation via subprocess (as module to avoid import issues)
    cmd = [
        sys.executable,
        "-m", "src.main",
        "--trade", trade,
        "--city", city,
        "--max", str(max_leads),
    ]

    print(f"Running: {' '.join(cmd)}\n")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(project_dir),
            check=False,  # Don't raise on non-zero exit
        )

        print()
        print("=" * 80)
        print("DAILY ROTATION COMPLETE")
        print("=" * 80)
        print(f"   Date: {today}")
        print(f"   City: {city}")
        print(f"   Trade: {trade}")
        print(f"   Exit code: {result.returncode}")
        print("=" * 80)

        if result.returncode != 0:
            print("\nNote: Pipeline exited with non-zero code (may be zero leads found)")

    except Exception as e:
        print(f"\n❌ Error running lead generation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
