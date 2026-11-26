#!/usr/bin/env python3
"""Dependency-free structural checks for the student finance workbook."""
from __future__ import annotations

import argparse
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
ERRORS = ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A")


def fail(message: str) -> None:
    raise AssertionError(message)


def sheet_parts(zf: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    relation_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("rel:Relationship", NS)}
    result = {}
    for node in workbook.findall("x:sheets/x:sheet", NS):
        rid = node.attrib[f"{{{NS['r']}}}id"]
        target = relation_map[rid].lstrip("/")
        result[node.attrib["name"]] = target if target.startswith("xl/") else "xl/" + target
    return result


def read_cell(root: ET.Element, address: str) -> tuple[str | None, str | None, str | None]:
    node = root.find(f".//x:c[@r='{address}']", NS)
    if node is None:
        return None, None, None
    formula_node = node.find("x:f", NS)
    value_node = node.find("x:v", NS)
    return (
        formula_node.text if formula_node is not None else None,
        value_node.text if value_node is not None else None,
        node.attrib.get("t"),
    )


def number(value: str | None, label: str) -> float:
    if value is None:
        fail(f"Missing cached numeric value: {label}")
    try:
        return float(value)
    except ValueError as exc:
        fail(f"Expected numeric value for {label}, got {value!r}: {exc}")


def assert_close(actual: float, expected: float, label: str, tol: float = 0.02) -> None:
    if not math.isclose(actual, expected, rel_tol=1e-9, abs_tol=tol):
        fail(f"{label}: expected {expected}, got {actual}")


def check_workbook(path: Path) -> None:
    if not path.exists():
        fail(f"Workbook not found: {path}")
    with zipfile.ZipFile(path) as zf:
        bad_member = zf.testzip()
        if bad_member:
            fail(f"Corrupt XLSX ZIP member: {bad_member}")
        parts = sheet_parts(zf)
        required = {"BAT_DAU", "DASHBOARD", "GIAO_DICH", "MUC_TIEU", "TINH_LAI", "DANH_MUC"}
        if not required.issubset(parts):
            fail(f"Missing worksheets: {sorted(required - set(parts))}")
        roots = {name: ET.fromstring(zf.read(part)) for name, part in parts.items()}

        dash = roots["DASHBOARD"]
        assert_close(number(read_cell(dash, "A7")[1], "DASHBOARD!A7"), 3_700_000, "Total income")
        assert_close(number(read_cell(dash, "C7")[1], "DASHBOARD!C7"), 595_000, "Total expenses")
        assert_close(number(read_cell(dash, "E7")[1], "DASHBOARD!E7"), 3_105_000, "Balance")
        assert_close(number(read_cell(dash, "G7")[1], "DASHBOARD!G7"), 3_105_000 / 3_700_000, "Savings rate", 1e-6)
        assert_close(number(read_cell(dash, "C12")[1], "DASHBOARD!C12"), 225_000, "Food spending")

        goals = roots["MUC_TIEU"]
        if not (read_cell(goals, "D54")[0] or "").startswith('IF(A54='):
            fail("Goal remaining formula is missing from D54")
        if not (read_cell(goals, "E54")[0] or "").startswith('IF(A54='):
            fail("Goal progress formula is missing from E54")
        assert_close(number(read_cell(goals, "D5")[1], "MUC_TIEU!D5"), 6_500_000, "Sample goal remaining")
        assert_close(number(read_cell(goals, "E5")[1], "MUC_TIEU!E5"), 0.1875, "Sample goal progress", 1e-6)

        interest = roots["TINH_LAI"]
        assert_close(number(read_cell(interest, "B12")[1], "TINH_LAI!B12"), 4_000_000 * 0.071 * 182 / 365, "Simple interest")
        assert_close(number(read_cell(interest, "B13")[1], "TINH_LAI!B13"), 4_000_000 + 4_000_000 * 0.071 * 182 / 365, "Principal plus interest")
        if "OR(" not in (read_cell(interest, "B12")[0] or ""):
            fail("Interest input guard is missing")

        tx = roots["GIAO_DICH"]
        dvs = tx.find("x:dataValidations", NS)
        ranges = {d.attrib.get("sqref") for d in dvs} if dvs is not None else set()
        for required_range in {"B6:B205", "C6:C205", "F6:F205"}:
            if required_range not in ranges:
                fail(f"Missing transaction dropdown range: {required_range}")

        xml_texts = [zf.read(n).decode("utf-8", errors="replace") for n in zf.namelist()
                     if n.startswith("xl/worksheets/") and n.endswith(".xml")]
        for error in ERRORS:
            if any(error in text for text in xml_texts):
                fail(f"Formula error token found in workbook: {error}")

    print("PASS: XLSX archive and six worksheets")
    print("PASS: dashboard sample totals and savings rate")
    print("PASS: sample goal formulas and 50-goal formula range")
    print("PASS: simple-interest formula and input guard")
    print("PASS: transaction dropdown ranges and no common formula errors")


def check_pdf(path: Path) -> None:
    if not path.exists():
        fail(f"PDF not found: {path}")
    pages = len(re.findall(rb"/Type\s*/Page(?!s)\b", path.read_bytes()))
    if pages != 6:
        fail(f"Expected 6 PDF pages, found {pages}")
    print("PASS: PDF exists and has 6 pages")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", default="Bo_quan_ly_tai_chinh_sinh_vien.xlsx")
    parser.add_argument("--pdf", default="Huong_dan_Bo_quan_ly_tai_chinh_sinh_vien.pdf")
    args = parser.parse_args()
    try:
        check_workbook(Path(args.workbook))
        check_pdf(Path(args.pdf))
    except (AssertionError, OSError, KeyError, ET.ParseError, zipfile.BadZipFile) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
