#!/usr/bin/env python3
"""Usage: find-android-node.py <uiautomator.xml> <labelPrefix> — prints the centre of the first match."""
import re
import sys

xml, prefix = open(sys.argv[1]).read(), sys.argv[2]
for label, bounds in re.findall(r'(?:content-desc|text)="([^"]+)"[^>]*?bounds="([^"]+)"', xml):
    if label.startswith(prefix):
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", bounds))
        print((x1 + x2) // 2, (y1 + y2) // 2)
        sys.exit(0)
sys.exit(f"No element starting with: {prefix}")
