"""Browser exports enter the existing review without any network acquisition."""

import json
from pathlib import Path
from typing import Any

import pytest

from knut_vandrar_backend.tracks.bundle import BundleSource, offer_download_cleanup
from knut_vandrar_backend.tracks.service import ingest

GPX = b'<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Trail 7A</name><trkseg><trkpt lat="59" lon="15"><ele>100</ele></trkpt><trkpt lat="60" lon="16"><ele>110</ele></trkpt></trkseg></trk></gpx>'


def export(directory: Path) -> tuple[Path, dict[str, Any]]:
    manifest = directory / "plotaroute-20512.json"
    data = {
        "format": "knut-vandrar-plotaroute",
        "version": 1,
        "collection": {
            "id": "20512",
            "url": "https://www.plotaroute.com/routecollection/20512",
            "name": "Trail",
            "route_names": ["Trail 7A ←", "Trail 8 ←"],
        },
        "routes": [
            {
                "source_id": "123",
                "source_order": 0,
                "filename": "Trail 7A (1).gpx",
                "metadata": {"RouteName": "Trail 7A ←", "About": "Start - Finish"},
            }
        ],
    }
    manifest.write_text(json.dumps(data))
    (directory / "Trail 7A (1).gpx").write_bytes(GPX)
    return manifest, data


def test_bundle_partial_import_and_review_preservation(tmp_path: Path) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    items = list(source.read("20512"))
    assert not items[0]["membership_complete"]
    assert items[1]["source_id"] == "123" and "path" in items[1]
    assert "error" in items[2]
    data: dict[str, Any] = {"routes": {}, "seen": [], "errors": {}}
    for item in items:
        ingest(data, item, tmp_path / "staging")
    route = data["routes"]["123"]
    assert route["details"]["stage"] == "7A"
    assert route["details"]["start"] == "Start"
    route["overrides"]["start"] = "Edited start"
    route["reviewed"] = True
    for item in source.read("20512"):
        ingest(data, item, tmp_path / "staging")
    assert data["routes"]["123"]["reviewed"]
    assert data["routes"]["123"]["overrides"]["start"] == "Edited start"


@pytest.mark.parametrize("filename", ["../outside.gpx", "/tmp/outside.gpx", "..\\outside.gpx"])
def test_bundle_rejects_paths(tmp_path: Path, filename: str) -> None:
    manifest, data = export(tmp_path)
    data["routes"][0]["filename"] = filename
    manifest.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="plain filename"):
        BundleSource(manifest)


def test_bundle_rejects_duplicate_source_ids_and_wrong_collection(tmp_path: Path) -> None:
    manifest, data = export(tmp_path)
    with pytest.raises(ValueError, match="differs"):
        list(BundleSource(manifest).read("999"))
    data["routes"].append(data["routes"][0])
    manifest.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="Duplicate"):
        BundleSource(manifest)


def test_bundle_reports_missing_symlink_and_wrong_gpx_without_losing_other_records(
    tmp_path: Path,
) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    path = tmp_path / "Trail 7A (1).gpx"
    path.unlink()
    assert "error" in list(source.read("20512"))[1]
    other = tmp_path / "other.gpx"
    other.write_bytes(GPX)
    path.symlink_to(other)
    assert "error" in list(source.read("20512"))[1]
    path.unlink()
    path.write_bytes(GPX.replace(b"Trail 7A", b"Wrong route"))
    assert "differs" in list(source.read("20512"))[1]["error"]


def test_bundle_accepts_separate_download_directory(tmp_path: Path) -> None:
    manifest, _ = export(tmp_path)
    downloads = tmp_path / "files"
    downloads.mkdir()
    (tmp_path / "Trail 7A (1).gpx").rename(downloads / "Trail 7A (1).gpx")
    assert "path" in list(BundleSource(manifest, downloads).read("20512"))[1]


@pytest.mark.parametrize("answer", ["", "n", "y", "yes"])
def test_cleanup_only_removes_bundle_downloads_after_confirmation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, answer: str
) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    list(source.read("20512"))
    unrelated = tmp_path / "unrelated.gpx"
    unrelated.write_bytes(GPX)
    monkeypatch.setattr("builtins.input", lambda _: answer)
    offer_download_cleanup(source)
    keep = answer not in {"y", "yes"}
    assert manifest.exists() == keep
    assert (tmp_path / "Trail 7A (1).gpx").exists() == keep
    assert unrelated.read_bytes() == GPX


@pytest.mark.parametrize("replacement", ["changed", "symlink"])
def test_cleanup_preserves_changed_files_and_manifest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, replacement: str
) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    list(source.read("20512"))
    path = tmp_path / "Trail 7A (1).gpx"
    if replacement == "changed":
        path.write_bytes(b"new contents")
    else:
        path.unlink()
        other = tmp_path / "other.gpx"
        other.write_bytes(GPX)
        path.symlink_to(other)
    monkeypatch.setattr("builtins.input", lambda _: "y")
    offer_download_cleanup(source)
    assert path.exists() and manifest.exists()


def test_cleanup_eof_keeps_downloads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    list(source.read("20512"))

    def end_input(_: str) -> str:
        raise EOFError

    monkeypatch.setattr("builtins.input", end_input)
    offer_download_cleanup(source)
    assert manifest.exists() and (tmp_path / "Trail 7A (1).gpx").exists()


def test_cleanup_preserves_files_inside_media_storage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest, _ = export(tmp_path)
    source = BundleSource(manifest)
    list(source.read("20512"))
    monkeypatch.setattr("builtins.input", lambda _: "y")
    offer_download_cleanup(source, protected_root=tmp_path)
    assert manifest.exists() and (tmp_path / "Trail 7A (1).gpx").exists()


def test_bundle_reads_source_positions_even_when_export_records_are_unordered(
    tmp_path: Path,
) -> None:
    manifest, data = export(tmp_path)
    (tmp_path / "Trail 8.gpx").write_bytes(GPX.replace(b"Trail 7A", b"Trail 8"))
    data["routes"].insert(
        0,
        {
            "source_id": "124",
            "source_order": 1,
            "filename": "Trail 8.gpx",
            "metadata": {"RouteName": "Trail 8 ←"},
        },
    )
    manifest.write_text(json.dumps(data))
    records = list(BundleSource(manifest).read("20512"))[1:]
    assert [record["source_id"] for record in records] == ["123", "124"]
    assert [record["source_order"] for record in records] == [0, 1]


@pytest.mark.parametrize("target", ["trail", "hike"])
def test_import_can_prompt_for_missing_parameters_one_at_a_time(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    target: str,
) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import complete_args, parse_args

    manifest, _ = export(tmp_path)
    monkeypatch.setattr(sys, "argv", ["tracks-import"])
    answers = iter(
        [target, "abc", str(manifest), "", "", *(["backward"] if target == "trail" else [])]
    )
    prompts: list[str] = []

    def answer(prompt: str) -> str:
        prompts.append(prompt)
        return next(answers)

    monkeypatch.setattr("builtins.input", answer)
    args = complete_args(parse_args())
    assert getattr(args, target) == "abc"
    assert args.bundle_source.identifier == "20512"
    assert args.gpx_dir == tmp_path
    assert args.direction == ("backward" if target == "trail" else None)
    assert len(prompts) == (6 if target == "trail" else 5)
    assert (
        all("direction" not in prompt.lower() for prompt in prompts) if target == "hike" else True
    )


def test_supplied_flags_skip_parameter_questions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import complete_args, parse_args

    manifest, _ = export(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "tracks-import",
            "--trail",
            "ber",
            "--bundle",
            str(manifest),
            "--gpx-dir",
            str(tmp_path),
            "--collection",
            "20512",
            "--direction",
            "backward",
            "--name",
            "My collection",
        ],
    )

    def no_question(_: str) -> str:
        raise AssertionError("Supplied parameters must not be prompted again")

    monkeypatch.setattr("builtins.input", no_question)
    args = complete_args(parse_args())
    assert args.name == "My collection" and args.trail == "ber"


def test_mixed_flags_only_prompt_for_missing_parameters(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import complete_args, parse_args

    manifest, _ = export(tmp_path)
    monkeypatch.setattr(sys, "argv", ["tracks-import", "--hike", "nor", "--bundle", str(manifest)])
    prompts: list[str] = []

    def answer(prompt: str) -> str:
        prompts.append(prompt)
        return ""

    monkeypatch.setattr("builtins.input", answer)
    args = complete_args(parse_args())
    assert args.hike == "nor" and args.direction is None
    assert len(prompts) == 2
    assert prompts[0].startswith("GPX directory")
    assert prompts[1].startswith("Plotaroute collection ID")
