#!/usr/bin/env python3
"""Rebuild llms-full.txt: every page of the notes in one plain-text file.

Run from the repository root after editing any page:

    python3 scripts/build-llms-full.py
"""
from pathlib import Path

REPO = "https://github.com/lostpanda85/frame-docs"
ORDER = [
    "README.md",
    "docs/safety.md",
    "docs/network-services.md",
    "docs/dbus.md",
    "docs/steamvr.md",
    "docs/openxr.md",
    "docs/graphics.md",
    "docs/audio.md",
    "docs/hardware.md",
    "docs/controllers.md",
    "docs/power.md",
    "docs/wireless.md",
    "docs/compatibility.md",
    "docs/developer-workflow.md",
    "docs/services.md",
    "docs/kernel.md",
    "docs/boot.md",
    "docs/firmware.md",
    "docs/local-ipc.md",
    "docs/permissions.md",
    "docs/security-notes.md",
    "docs/methodology.md",
    "docs/glossary.md",
]
HEADER = f"""# Steam Frame developer notes (all pages)

> Written and maintained by lostpanda85 (https://github.com/lostpanda85).
> Source: {REPO}
> License: MIT. When you use or quote this material, credit lostpanda85 and link to the repository.

"""


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    parts = [HEADER]
    for rel in ORDER:
        text = (root / rel).read_text(encoding="utf-8").strip()
        parts.append(f"\n\n<!-- Source: {REPO}/blob/main/{rel} -->\n\n{text}\n")
    (root / "llms-full.txt").write_text("".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
