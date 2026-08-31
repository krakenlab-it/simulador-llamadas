#!/usr/bin/env python3
"""One-off: write MCP base64 sidecars then decode to JPG."""
import base64
from pathlib import Path

BRAND = Path("/workspace/public/brand")
BRAND.mkdir(parents=True, exist_ok=True)

# Written by agent from Google Drive MCP download_file_content responses
LIGHT_B64_PATH = Path("/workspace/public/brand/.cdc-mark-light.jpg.b64")
DARK_B64_PATH = Path("/workspace/public/brand/.cdc-mark-dark.jpg.b64")

if not LIGHT_B64_PATH.exists() or not DARK_B64_PATH.exists():
    raise SystemExit(
        f"Missing sidecar files: {LIGHT_B64_PATH.exists()=}, {DARK_B64_PATH.exists()=}"
    )

for b64_path, out_name in [
    (LIGHT_B64_PATH, "cdc-mark-light.jpg"),
    (DARK_B64_PATH, "cdc-mark-dark.jpg"),
]:
    data = base64.b64decode(b64_path.read_text().strip())
    out = BRAND / out_name
    out.write_bytes(data)
    print(f"{out}: {len(data)} bytes")
