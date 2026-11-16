"""Fail CI on runtime major versions whose upstream support has ended.

Reviewed 2026-11-16 against nodejs.org and python.org; update deliberately.
This is an EOL check, not a vulnerability scanner.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
unsupported = {"node": {"18", "20"}, "python": {"3.10"}}
findings = []
for path in ROOT.glob("*/Dockerfile*"):
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = re.match(r"\s*FROM\s+(node|python):([0-9]+(?:\.[0-9]+)?)", line, re.I)
        if match and match.group(2) in unsupported[match.group(1).lower()]:
            findings.append(f"{path.relative_to(ROOT)}:{number}: {match.group(1)} {match.group(2)} sin soporte")
for finding in findings:
    print(f"::error::{finding}")
if findings:
    print("Actualizar requiere revisar compatibilidad y autorización para cambios mayores.")
    sys.exit(1)
print("Sin runtimes EOL conocidos en los Dockerfiles examinados (revisión 2026-11-16).")
