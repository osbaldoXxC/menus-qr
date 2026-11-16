"""Reject silently skipped required tests in JUnit XML."""
import sys
import xml.etree.ElementTree as ET

if len(sys.argv) < 2:
    raise SystemExit("Indica al menos un archivo JUnit XML")
for filename in sys.argv[1:]:
    root = ET.parse(filename).getroot()
    skipped = len(root.findall('.//skipped'))
    if root.tag == 'skipped':
        skipped += 1
    if skipped:
        raise SystemExit(f'{filename}: {skipped} pruebas omitidas')
    print(f'{filename}: sin pruebas omitidas')
