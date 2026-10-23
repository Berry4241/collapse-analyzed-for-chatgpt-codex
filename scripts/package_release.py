#!/usr/bin/env python3
"""Create the unpacked-Chrome-extension ZIP asset used by GitHub Releases."""
from pathlib import Path
import json
from zipfile import ZipFile, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))
version=manifest["version"]
files=[
    Path("manifest.json"),
    Path("background.js"),
    Path("collapse.js"),
    *sorted(Path("icons").glob("*.png")),
]
missing=[str(path) for path in files if not (ROOT/path).is_file()]
if missing:
    raise SystemExit(f"Missing expected extension files: {missing}")
out=ROOT/"dist"/f"collapse-analyzed-for-chatgpt-codex-v{version}.zip"
out.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(out,"w",compression=ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(ROOT/path,arcname=path.as_posix())
print(f"Created {out}")
