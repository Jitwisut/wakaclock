#!/usr/bin/env python3
"""Claude receipt campaign; isolated local account and separate authentication required."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'work-sessions'))
from receipt_campaign import main

if __name__ == '__main__':
    sys.exit(main('claude-code'))
