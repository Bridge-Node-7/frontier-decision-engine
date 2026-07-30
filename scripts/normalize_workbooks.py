#!/usr/bin/env python3
"""Normalize the three source XLSX workbooks into public-safe OPV JSON datasets.

Zero third-party dependencies. Reads cached worksheet values from the XLSX package,
preserves source hashes, excludes spreadsheet formulas from the public data, and
redacts sensitive experience details by design.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import statistics
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN, "r": REL}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def column_index(cell_reference: str) -> int:
    match = re.match(r"([A-Z]+)", cell_reference)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_reference}")
    value = 0
    for character in match.group(1):
        value = value * 26 + ord(character) - 64
    return value - 1


def normalize_number(value: str | None) -> Any:
    if value is None or value == "":
        return None
    try:
        number = float(value)
        return int(number) if number.is_integer() else number
    except ValueError:
        return value


class XlsxReader:
    def __init__(self, path: Path):
        self.path = path
        self._zip = zipfile.ZipFile(path)
        self._shared_strings = self._load_shared_strings()
        self._sheet_targets = self._load_sheet_targets()

    def close(self) -> None:
        self._zip.close()

    def _load_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self._zip.namelist():
            return []
        root = ET.fromstring(self._zip.read("xl/sharedStrings.xml"))
        return [
            "".join(text.text or "" for text in item.iter(f"{{{MAIN}}}t"))
            for item in root.findall("m:si", NS)
        ]

    def _load_sheet_targets(self) -> dict[str, str]:
        workbook = ET.fromstring(self._zip.read("xl/workbook.xml"))
        relationships = ET.fromstring(self._zip.read("xl/_rels/workbook.xml.rels"))
        relation_map = {node.attrib["Id"]: node.attrib["Target"] for node in relationships}
        targets: dict[str, str] = {}
        sheets_node = workbook.find("m:sheets", NS)
        for sheet in list(sheets_node) if sheets_node is not None else []:
            relation_id = sheet.attrib[f"{{{REL}}}id"]
            target = relation_map[relation_id]
            if not target.startswith("xl/"):
                target = f"xl/{target.lstrip('/')}"
            targets[sheet.attrib["name"]] = target
        return targets

    def rows(self, sheet_name: str) -> list[list[Any]]:
        target = self._sheet_targets[sheet_name]
        root = ET.fromstring(self._zip.read(target))
        output: list[list[Any]] = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            cells: dict[int, Any] = {}
            for cell in row.findall("m:c", NS):
                index = column_index(cell.attrib["r"])
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                inline_node = cell.find("m:is", NS)
                value: Any = None
                if cell_type == "s" and value_node is not None:
                    value = self._shared_strings[int(value_node.text or 0)]
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = "".join(
                        text.text or "" for text in inline_node.iter(f"{{{MAIN}}}t")
                    )
                elif cell_type == "b" and value_node is not None:
                    value = value_node.text == "1"
                elif value_node is not None:
                    value = normalize_number(value_node.text)
                cells[index] = value
            if cells:
                values = [None] * (max(cells) + 1)
                for index, value in cells.items():
                    values[index] = value
                output.append(values)
        return output


def records_from_header(rows: list[list[Any]], header_row: int = 0) -> list[dict[str, Any]]:
    headers = [str(value).strip() if value is not None else "" for value in rows[header_row]]
    records: list[dict[str, Any]] = []
    for values in rows[header_row + 1 :]:
        record: dict[str, Any] = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            record[header] = values[index] if index < len(values) else None
        if any(value not in (None, "") for value in record.values()):
            records.append(record)
    return records


def split_codes(value: Any) -> list[str]:
    if not isinstance(value, str):
        return []
    return [code.strip() for code in value.split("|") if code.strip()]


def mean_or_none(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def rounded(value: Any, digits: int = 6) -> Any:
    return round(value, digits) if isinstance(value, float) and math.isfinite(value) else value


def normalize_morphology(path: Path) -> dict[str, Any]:
    reader = XlsxReader(path)
    try:
        inputs = reader.rows("Inputs")
        input_map = {
            row[0]: row[1]
            for row in inputs
            if len(row) >= 2 and isinstance(row[0], str) and row[1] is not None
        }
        data_records = records_from_header(reader.rows("Data"))
        objects = []
        for record in data_records:
            if record.get("Morphology") not in {"Orb", "Rod"}:
                continue
            length_replicates = [
                record.get(f"Length_Rep{index}") for index in range(1, 7)
                if isinstance(record.get(f"Length_Rep{index}"), (int, float))
            ]
            width_replicates = [
                record.get(f"Width_Rep{index}") for index in range(1, 7)
                if isinstance(record.get(f"Width_Rep{index}"), (int, float))
            ]
            offset_replicates = [
                record.get(f"VertOffset_Rep{index}") for index in range(1, 7)
                if isinstance(record.get(f"VertOffset_Rep{index}"), (int, float))
            ]
            objects.append({
                "object_id": record.get("Object_ID"),
                "morphology": record.get("Morphology"),
                "pixel_length": rounded(record.get("Pixels_Length")),
                "pixel_width": rounded(record.get("Pixels_Width")),
                "vertical_offset_px": rounded(record.get("Px_Vert_Offset")),
                "angular_length_deg": rounded(record.get("Ang_Length_deg")),
                "angular_width_deg": rounded(record.get("Ang_Width_deg")),
                "angular_uncertainty_deg": rounded(record.get("Ang_Unc_deg")),
                "aspect_ratio": rounded(record.get("Aspect_Ratio")),
                "rod_class": record.get("Rod_Class") or None,
                "length_replicates_px": [rounded(value) for value in length_replicates],
                "width_replicates_px": [rounded(value) for value in width_replicates],
                "vertical_offset_replicates_px": [rounded(value) for value in offset_replicates],
                "length_status": record.get("Length_Status") or None,
                "width_status": record.get("Width_Status") or None,
                "vertical_offset_status": record.get("VertOffset_Status") or None,
                "vertical_offset_source": record.get("VertOffset_Source") or None,
            })

        velocity_rows = reader.rows("Velocity_Data")
        velocity_records = records_from_header(velocity_rows, header_row=6)
        track_points = []
        valid_intervals = []
        for record in velocity_records:
            if record.get("Morphology") not in {"Orb", "Rod"}:
                continue
            point = {
                "sequence_id": record.get("Sequence_ID"),
                "object_id": record.get("Object_ID"),
                "morphology": record.get("Morphology"),
                "frame_no": record.get("Frame_No"),
                "x_centroid_px": rounded(record.get("X_centroid_px")),
                "y_centroid_px": rounded(record.get("Y_centroid_px")),
                "source_frame_notes": record.get("Source_Frame_Notes") or None,
                "delta_frames": record.get("Delta_Frames"),
                "delta_t_s": rounded(record.get("Delta_t_s")),
                "pixel_displacement_px": rounded(record.get("Pixel_Displacement_px")),
                "angular_displacement_deg": rounded(record.get("Angular_Displacement_deg")),
                "angular_speed_deg_s": rounded(record.get("Angular_Speed_deg_s")),
                "interval_status": record.get("Interval_Status"),
                "use_in_summary": bool(record.get("Use_In_Summary") == 1),
            }
            track_points.append(point)
            if point["use_in_summary"] and isinstance(point["angular_speed_deg_s"], (int, float)):
                valid_intervals.append(point)

        by_sequence: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for point in valid_intervals:
            by_sequence[str(point["sequence_id"])].append(point)
        sequences = []
        for sequence_id, points in sorted(by_sequence.items()):
            speeds = [float(point["angular_speed_deg_s"]) for point in points]
            sequences.append({
                "sequence_id": sequence_id,
                "object_id": points[0]["object_id"],
                "morphology": points[0]["morphology"],
                "valid_intervals": len(points),
                "mean_angular_speed_deg_s": rounded(statistics.fmean(speeds)),
                "min_angular_speed_deg_s": rounded(min(speeds)),
                "max_angular_speed_deg_s": rounded(max(speeds)),
            })

        morphology_counts = Counter(item["morphology"] for item in objects)
        interval_speeds: dict[str, list[float]] = defaultdict(list)
        sequence_speeds: dict[str, list[float]] = defaultdict(list)
        for point in valid_intervals:
            interval_speeds[point["morphology"]].append(float(point["angular_speed_deg_s"]))
        for sequence in sequences:
            sequence_speeds[sequence["morphology"]].append(float(sequence["mean_angular_speed_deg_s"]))

        return {
            "dataset_id": "opv-morphology-karijini-v1",
            "dataset_type": "observation",
            "title": "Karijini Morphology and Motion",
            "schema_version": "0.1.0",
            "evidence_class": "measured-and-derived-single-camera-analysis",
            "source": {
                "filename": path.name,
                "sha256": sha256_file(path),
                "included_in_public_repository": False,
            },
            "calibration": {
                "horizontal_field_of_view_deg": input_map.get("HFOV (deg)"),
                "vertical_field_of_view_deg": input_map.get("VFOV (deg)"),
                "horizontal_pixels": input_map.get("Horizontal pixels"),
                "vertical_pixels": input_map.get("Vertical pixels"),
                "boundary_tolerance_px": input_map.get("Boundary tolerance (± px)"),
                "camera_height_m": input_map.get("Camera height above ground (m)"),
                "default_tilt_deg": input_map.get("Default camera tilt (deg)"),
                "rod_extended_threshold_deg": input_map.get("Rod extended threshold (deg)"),
                "status": "assumption-based-and-partially-documented",
            },
            "summary": {
                "objects": len(objects),
                "orb_objects": morphology_counts["Orb"],
                "rod_objects": morphology_counts["Rod"],
                "sequences": len(sequences),
                "valid_intervals": len(valid_intervals),
                "interval_mean_angular_speed_deg_s": {
                    morphology: rounded(mean_or_none(values))
                    for morphology, values in interval_speeds.items()
                },
                "sequence_mean_angular_speed_deg_s": {
                    morphology: rounded(mean_or_none(values))
                    for morphology, values in sequence_speeds.items()
                },
            },
            "limitations": [
                "Original public media is not included in this repository.",
                "True range, physical size, altitude, and three-dimensional velocity are not established.",
                "Single-camera angular measurements depend on field-of-view and camera-stability assumptions.",
                "Frame intervals within a sequence are nested and must not be treated as independent events.",
                "Compact and Extended rod classes are defined by the same angular-length variable used to compare them.",
            ],
            "objects": objects,
            "sequences": sequences,
            "track_points": track_points,
        }
    finally:
        reader.close()


def normalize_experiences(path: Path) -> dict[str, Any]:
    reader = XlsxReader(path)
    try:
        categories = records_from_header(reader.rows("00_Categories"))
        stages = records_from_header(reader.rows("01_Stages"))
        life_periods = records_from_header(reader.rows("02_Life_Periods"))
        primary_source = records_from_header(reader.rows("Raw_Encounters"))
        subphase_source = records_from_header(reader.rows("Subphase_Encounters"))

        def public_record(record: dict[str, Any], event_type: str) -> dict[str, Any]:
            return {
                "event_id": record.get("Encounter_ID"),
                "parent_event_id": record.get("Parent_Encounter_ID") or None,
                "label": record.get("Label"),
                "life_period": record.get("Life_Period"),
                "stage_code": record.get("Stage_Code"),
                "category_codes": split_codes(record.get("Category_Codes")),
                "event_type": event_type,
                "privacy_transform": "exact dates, ages, locations, and narrative descriptions omitted",
            }

        primary = [public_record(record, "primary") for record in primary_source]
        subphases = [public_record(record, "subphase") for record in subphase_source]
        all_units = primary + subphases

        stage_primary = Counter(record["stage_code"] for record in primary)
        stage_all = Counter(record["stage_code"] for record in all_units)
        category_primary = Counter(code for record in primary for code in record["category_codes"])
        category_all = Counter(code for record in all_units for code in record["category_codes"])
        for category in categories:
            code = category.get("Category_Code")
            if code:
                category_primary.setdefault(code, 0)
                category_all.setdefault(code, 0)
        shared_subphase_codes = sorted({tuple(record["category_codes"]) for record in subphases})

        return {
            "dataset_id": "opv-experiences-public-safe-v1",
            "dataset_type": "experience",
            "title": "Longitudinal Experience Registry — Public-Safe Edition",
            "schema_version": "0.1.0",
            "evidence_class": "reported-and-analyst-coded",
            "source": {
                "filename": path.name,
                "sha256": sha256_file(path),
                "included_in_public_repository": False,
            },
            "privacy": {
                "status": "public-safe-derived-edition",
                "omitted_fields": [
                    "year_or_date",
                    "age_or_range",
                    "location",
                    "brief_description",
                ],
                "reason": "Minimize re-identification and sensitive personal disclosure while preserving analytic structure.",
            },
            "summary": {
                "primary_encounters": len(primary),
                "nested_subphases": len(subphases),
                "analytic_units": len(all_units),
                "stage_counts_primary": dict(sorted(stage_primary.items())),
                "stage_counts_all_units": dict(sorted(stage_all.items())),
                "category_counts_primary": dict(sorted(category_primary.items())),
                "category_counts_all_units": dict(sorted(category_all.items())),
                "all_subphases_share_one_category_template": len(shared_subphase_codes) == 1,
                "subphase_category_template": list(shared_subphase_codes[0]) if len(shared_subphase_codes) == 1 else None,
            },
            "limitations": [
                "The records document reported experiences and analyst coding, not independently verified external events.",
                "Twenty-two subphases are nested within eight primary encounters and are not independent encounters.",
                "All imported subphases share the same four-category assignment, which inflates those expanded totals.",
                "Life periods are unequal exposure windows and counts are not duration-normalized incidence rates.",
                "The public-safe edition omits source narratives and therefore cannot support independent recoding.",
            ],
            "categories": categories,
            "stages": stages,
            "life_periods": life_periods,
            "primary_events": primary,
            "subphases": subphases,
        }
    finally:
        reader.close()


def yes_no(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() == "yes"


def normalize_references(path: Path) -> dict[str, Any]:
    reader = XlsxReader(path)
    try:
        master_rows = records_from_header(reader.rows("Master"))
        signatures_rows = reader.rows("Signature_Map")
        scoring_rows = records_from_header(reader.rows("Scoring"))

        signatures: dict[str, dict[str, bool]] = {}
        for values in signatures_rows[1:]:
            if not values or not isinstance(values[0], str):
                continue
            signatures[values[0]] = {
                "halos_filaments": yes_no(values[2] if len(values) > 2 else None),
                "pane_like_laminar_shells": yes_no(values[3] if len(values) > 3 else None),
                "trans_medium_no_wake": yes_no(values[4] if len(values) > 4 else None),
                "localized_lensing_cloaking": yes_no(values[5] if len(values) > 5 else None),
                "symmetric_axial_emissions": yes_no(values[6] if len(values) > 6 else None),
            }

        scores = {
            record.get("Reference"): {
                "boundary_link_score": record.get("Boundary_Link_Score (1–5)"),
                "srms_link_score": record.get("SRMS_Link_Score (1–5)"),
                "notes": record.get("Notes") or None,
            }
            for record in scoring_rows
            if isinstance(record.get("Reference"), str)
        }

        references = []
        for index, record in enumerate(master_rows, start=1):
            reference = record.get("Reference") or record.get("Column1")
            if not isinstance(reference, str) or not reference.strip():
                continue
            references.append({
                "reference_id": f"REF-{index:03d}",
                "citation_as_entered": reference,
                "about": record.get("About") or record.get("Column2"),
                "boundary_interpretation": record.get("Boundary-Layer Effects") or record.get("Column3"),
                "srms_interpretation": record.get("SRMS Relation") or record.get("Column4"),
                "theme": record.get("Theme") or record.get("Column5"),
                "source_table": record.get("Source_Table") or record.get("Column7"),
                "signatures": signatures.get(reference, {}),
                "scores": scores.get(reference, {}),
                "verification_status": "workbook_mapping_only",
            })

        theme_counts = Counter(record["theme"] for record in references)
        signature_counts = Counter()
        for reference in references:
            for signature, value in reference["signatures"].items():
                if value:
                    signature_counts[signature] += 1

        boundary_scores = [
            float(reference["scores"]["boundary_link_score"])
            for reference in references
            if isinstance(reference.get("scores", {}).get("boundary_link_score"), (int, float))
        ]
        srms_scores = [
            float(reference["scores"]["srms_link_score"])
            for reference in references
            if isinstance(reference.get("scores", {}).get("srms_link_score"), (int, float))
        ]

        return {
            "dataset_id": "opv-thematic-reference-map-v1",
            "dataset_type": "reference_map",
            "title": "UAP Thematic Research Map",
            "schema_version": "0.1.0",
            "evidence_class": "referenced-and-analyst-interpreted",
            "source": {
                "filename": path.name,
                "sha256": sha256_file(path),
                "included_in_public_repository": False,
            },
            "summary": {
                "reference_clusters": len(references),
                "theme_counts": dict(sorted(theme_counts.items())),
                "signature_association_counts": dict(sorted(signature_counts.items())),
                "average_boundary_link_score": rounded(mean_or_none(boundary_scores)),
                "average_srms_link_score": rounded(mean_or_none(srms_scores)),
            },
            "limitations": [
                "Rows are reference clusters and may bundle multiple publications.",
                "Mappings and scores are analyst judgments, not probabilities or independent confirmation.",
                "Bibliographic identifiers, direct quotations, page references, peer-review status, and replication status require verification.",
                "Established science, observational resemblance, and speculative engineering application must remain separate evidence classes.",
            ],
            "references": references,
        }
    finally:
        reader.close()


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--morphology", type=Path, required=True)
    parser.add_argument("--experiences", type=Path, required=True)
    parser.add_argument("--references", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    outputs = {
        "morphology.json": normalize_morphology(args.morphology),
        "experiences.json": normalize_experiences(args.experiences),
        "references.json": normalize_references(args.references),
    }
    for filename, data in outputs.items():
        write_json(args.out / filename, data)
        print(f"wrote {args.out / filename}")


if __name__ == "__main__":
    main()
