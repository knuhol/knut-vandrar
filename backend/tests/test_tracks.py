"""Track parsing and restartable editorial review, without network or Docker."""

import copy
from pathlib import Path
from typing import Any

import pytest

from knut_vandrar_backend.tracks.bundle import collection_id
from knut_vandrar_backend.tracks.cli import review
from knut_vandrar_backend.tracks.gpx import endpoints, normalize, store, track_path
from knut_vandrar_backend.tracks.service import ingest

GPX = b"""<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
<wpt lat="59" lon="15"><name>Water</name><sym>Drinking Water</sym></wpt>
<trk><name>Trail 7A \xe2\x86\x90</name><trkseg>
<trkpt lat="59" lon="15"><ele>123</ele><time>2026-11-19T00:00:00Z</time></trkpt>
<trkpt lat="60" lon="16"><ele>234</ele></trkpt></trkseg></trk></gpx>"""


def test_gpx_preserves_geometry_and_pois_and_ignores_export_time(tmp_path: Path) -> None:
    result, details = normalize(GPX, "Trail 7A ←")
    second, _ = normalize(GPX.replace(b"2026-11-19", b"2026-11-20"), "Trail 7A ←")
    assert result == second
    assert b"123" in result and b"234" in result
    assert b"time>" not in result and "←" not in result.decode()
    assert details["point_count"] == 2 and details["pois"][0]["sym"] == "Drinking Water"
    digest = store(tmp_path, result)
    assert store(tmp_path, result) == digest
    assert track_path(tmp_path, digest).read_bytes() == result
    with pytest.raises(ValueError):
        normalize(GPX.replace(b'lat="60"', b'lat="nan"'), "Trail")
    with pytest.raises(ValueError):
        normalize(b"<!DOCTYPE x><gpx/>", "Trail")


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Gillersklack - Kloten", ("Gillersklack", "Kloten")),
        ("A - B - C", (None, None)),
        (" - B", (None, None)),
        ("A-B", (None, None)),
        ("", (None, None)),
    ],
    ids=[
        "two-place-names",
        "ambiguous-extra-separator",
        "missing-start",
        "missing-separator-spaces",
        "empty-description",
    ],
)
def test_endpoint_parsing(description: str, expected: tuple[str | None, str | None]) -> None:
    assert endpoints(description) == expected


def test_review_resumes_without_losing_manual_endpoint_edits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "sample.gpx"
    path.write_bytes(GPX)
    data: dict[str, Any] = {
        "direction": "backward",
        "name": "Trail",
        "routes": {},
        "errors": {},
        "seen": [],
    }
    item = {
        "source_id": "123",
        "source_order": 0,
        "path": str(path),
        "metadata": {"RouteName": "Trail 7A ←", "About": "A - B"},
    }
    ingest(data, item, tmp_path)
    assert data["routes"]["123"]["details"]["stage"] == "7A"
    answers = iter(["e", "3", "Corrected start", "q"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    checkpoints = []
    assert not review(data, lambda: checkpoints.append(copy.deepcopy(data)))
    resumed = checkpoints[-1]
    assert resumed["routes"]["123"]["overrides"]["start"] == "Corrected start"
    assert not resumed["routes"]["123"]["reviewed"]
    answers = iter(["", "s"])
    assert review(resumed, lambda: None)
    assert resumed["routes"]["123"]["reviewed"]
    ingest(resumed, item, tmp_path)
    assert resumed["routes"]["123"]["reviewed"]
    assert resumed["routes"]["123"]["overrides"]["start"] == "Corrected start"


def test_collection_input_validation() -> None:
    assert collection_id("https://www.plotaroute.com/routecollection/20512") == "20512"
    with pytest.raises(ValueError):
        collection_id("https://example.com/20512")


@pytest.mark.parametrize("direction", ["forward", "backward"])
def test_review_keeps_plotaroute_order_instead_of_sorting_stage_numbers(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    direction: str,
) -> None:
    path = tmp_path / "route.gpx"
    path.write_bytes(GPX)
    data: dict[str, Any] = {
        "direction": direction,
        "name": "Trail",
        "routes": {},
        "errors": {},
        "seen": [],
    }
    # Deliberately insert records out of order, with non-monotonic official stages.
    for identifier, order, name in [
        ("30", 2, "Trail 7A"),
        ("20", 0, "Trail 17"),
        ("10", 1, "Trail 2"),
    ]:
        ingest(
            data,
            {
                "source_id": identifier,
                "source_order": order,
                "path": str(path),
                "metadata": {"RouteName": name},
            },
            tmp_path / "staging",
        )
        data["routes"][identifier]["overrides"]["order"] = 9 - order
    answers = iter(["", "", "", "s"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    assert review(data, lambda: None)
    stage_headers = [
        line for line in capsys.readouterr().out.splitlines() if line.startswith("Stage ")
    ]
    assert stage_headers == [
        "Stage 1 of 3 — Trail 17",
        "Stage 2 of 3 — Trail 2",
        "Stage 3 of 3 — Trail 7A",
    ]


@pytest.mark.parametrize(
    ("notes", "title", "expected"),
    [
        (
            "Notes start - Notes finish",
            "Title start - Title finish",
            ("Notes start", "Notes finish"),
        ),
        ("", "Title start - Title finish ←", ("Title start", "Title finish")),
        ("Other notes without endpoints", "Start - Finish", ("Start", "Finish")),
        ("A - B - C", "Start - Finish", ("Start", "Finish")),
        ("", "Ordinary route title", (None, None)),
        ("", "A - B - C", (None, None)),
        ("", " - Finish", (None, None)),
        ("", "Start - ", (None, None)),
        ("", "Start - Finish\nExtra text", (None, None)),
        ("", "Start - Finish\rExtra text", (None, None)),
    ],
    ids=[
        "notes-override-title",
        "title-with-direction-arrow",
        "notes-without-endpoints",
        "ambiguous-notes-use-title",
        "title-without-endpoints",
        "ambiguous-title",
        "missing-start",
        "missing-finish",
        "multiline-title",
        "carriage-return-in-title",
    ],
)
def test_endpoint_notes_take_priority_then_title_fallback(
    tmp_path: Path,
    notes: str,
    title: str,
    expected: tuple[str | None, str | None],
) -> None:
    path = tmp_path / "route.gpx"
    path.write_bytes(GPX)
    data: dict[str, Any] = {"routes": {}, "seen": [], "errors": {}}
    item = {
        "source_id": "1",
        "source_order": 0,
        "path": str(path),
        "metadata": {"RouteName": title, "About": notes},
    }
    ingest(data, item, tmp_path / "staging")
    route = data["routes"]["1"]
    assert (route["details"]["start"], route["details"]["end"]) == expected
    route["overrides"] = {"start": "Manual correction", "order": 999}
    ingest(data, item, tmp_path / "staging")
    assert data["routes"]["1"]["overrides"] == {"start": "Manual correction"}
    assert data["routes"]["1"]["details"]["source_order"] == 0


@pytest.mark.parametrize(
    ("target", "direction", "valid"),
    [
        ("--hike", [], True),
        ("--hike", ["--direction", "backward"], False),
        ("--trail", [], True),
        ("--trail", ["--direction", "backward"], True),
    ],
    ids=[
        "hike-without-direction",
        "hike-rejects-direction",
        "trail-prompts-for-direction",
        "trail-accepts-direction",
    ],
)
def test_direction_arguments_apply_only_to_trails(
    monkeypatch: pytest.MonkeyPatch,
    target: str,
    direction: list[str],
    valid: bool,
) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import parse_args

    monkeypatch.setattr(
        sys, "argv", ["tracks-import", target, "abc", "--bundle", "bundle.json", *direction]
    )
    if valid:
        args = parse_args()
        assert args.direction == ("backward" if direction else None)
    else:
        with pytest.raises(SystemExit) as error:
            parse_args()
        assert error.value.code == 2


def test_hike_collection_review_does_not_ask_for_direction(monkeypatch: pytest.MonkeyPatch) -> None:
    data: dict[str, Any] = {"direction": None, "name": "Old name", "routes": {}, "errors": {}}
    answers = iter(["c", "New name", "s"])
    prompts: list[str] = []

    def answer(prompt: str) -> str:
        prompts.append(prompt)
        return next(answers)

    monkeypatch.setattr("builtins.input", answer)
    assert review(data, lambda: None)
    assert data["name"] == "New name" and data["direction"] is None
    assert all("Direction" not in prompt for prompt in prompts)


def test_collection_name_requires_explicit_valid_text(monkeypatch: pytest.MonkeyPatch) -> None:
    from knut_vandrar_backend.tracks.cli import ask_name

    answers = iter(["", " " * 3, "x" * 301, "  My chosen collection  "])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    assert ask_name("Collection name") == "My chosen collection"


def test_single_gpx_source_and_route_geometry(tmp_path: Path) -> None:
    from knut_vandrar_backend.tracks.sources import SINGLE_GPX_ID, SingleGpxSource

    path = tmp_path / "single.gpx"
    path.write_bytes(GPX)
    source = SingleGpxSource(path)
    items = list(source.read(source.identifier))
    assert items[0]["expected"] == 1 and items[0]["membership_complete"]
    assert items[1]["source_id"] == SINGLE_GPX_ID
    assert items[1]["metadata"]["RouteName"] == "Trail 7A"
    assert items[1]["source_order"] == 0
    original = path.read_bytes()
    route_gpx = GPX.replace(b"<trk>", b"<rte>").replace(b"</trk>", b"</rte>")
    route_gpx = route_gpx.replace(b"<trkseg>", b"").replace(b"</trkseg>", b"")
    route_gpx = route_gpx.replace(b"trkpt", b"rtept")
    path.write_bytes(route_gpx)
    assert SingleGpxSource(path).identifier == source.identifier
    normalized, geometry = normalize(route_gpx, "Route")
    assert geometry["point_count"] == 2 and geometry["pois"][0]["name"] == "Water"
    assert b"trkpt" in normalized and b"rtept" not in normalized
    assert b"123" in normalized and b"234" in normalized
    assert b"time>" not in normalized
    assert original == GPX


def test_single_gpx_rejects_multiple_tracks_unsafe_xml_and_symlinks(tmp_path: Path) -> None:
    from knut_vandrar_backend.tracks.sources import SingleGpxSource

    path = tmp_path / "single.gpx"
    for content in [
        GPX.replace(b"</gpx>", b"<trk><name>Second</name></trk></gpx>"),
        b"<!DOCTYPE x><gpx/>",
        b"not xml",
    ]:
        path.write_bytes(content)
        with pytest.raises(ValueError):
            SingleGpxSource(path)
    path.write_bytes(GPX)
    linked = tmp_path / "linked.gpx"
    linked.symlink_to(path)
    with pytest.raises(ValueError, match="symlink"):
        SingleGpxSource(linked)


def test_single_gpx_flags_and_interactive_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import complete_args, parse_args

    path = tmp_path / "route.gpx"
    path.write_bytes(GPX)
    monkeypatch.setattr(sys, "argv", ["tracks-import", "--hike", "Muddus", "--gpx", str(path)])
    args = complete_args(parse_args())
    assert args.collection == "gpx:single" and args.direction is None
    monkeypatch.setattr(sys, "argv", ["tracks-import"])
    answers = iter(["hike", "Muddus", str(path)])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    args = complete_args(parse_args())
    assert args.gpx == path and args.collection == "gpx:single"


@pytest.mark.parametrize(
    "extra",
    [["--bundle", "x.json"], ["--collection", "1"], ["--gpx-dir", "."]],
    ids=["bundle-file", "collection-id", "download-directory"],
)
def test_single_gpx_rejects_bundle_flags(extra: list[str], monkeypatch: pytest.MonkeyPatch) -> None:
    import sys

    from knut_vandrar_backend.tracks.cli import parse_args

    monkeypatch.setattr(
        sys, "argv", ["tracks-import", "--hike", "Muddus", "--gpx", "route.gpx", *extra]
    )
    with pytest.raises(SystemExit) as error:
        parse_args()
    assert error.value.code == 2
