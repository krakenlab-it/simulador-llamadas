#!/usr/bin/env python3
"""Save MCP download_file_content JSON from stdin to brand sidecar + JPG."""
import base64
import json
import sys
from pathlib import Path

BRAND = Path("/workspace/public/brand")
data = json.load(sys.stdin)
name = data.get("title") or sys.argv[1]
b64 = data["content"]
sidecar = BRAND / f".{name}.b64"
out = BRAND / name
BRAND.mkdir(parents=True, exist_ok=True)
sidecar.write_text(b64)
raw = base64.b64decode(b64)
out.write_bytes(raw)
print(f"{out}: {len(raw)} bytes")
