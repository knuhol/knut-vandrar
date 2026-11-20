"""Stopping fixes split ordered GPX geometry without inventing connecting lines."""

import copy
from typing import Any

import pytest

from knut_vandrar_backend.maps.progress import split_at_stop


def sample() -> dict[str, Any]:
    return {
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"stage": "10"},
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": [[[15, 59], [15.01, 59]], [[15.02, 59], [15.03, 59]]],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"stage": "11"},
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": [[[15.03, 59], [15.04, 59], [15.05, 59]]],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"stage": "12"},
                    "geometry": {
                        "type": "MultiLineString",
                        "coordinates": [[[15.05, 59], [15.06, 59]]],
                    },
                },
            ],
        }
    }


def test_stop_splits_the_selected_stage_preserving_segments_and_original() -> None:
    route = sample()
    original = copy.deepcopy(route)
    result = split_at_stop(route, 59.00001, 15.045, "11")
    assert route == original
    assert result["stop"]["coordinates"] == pytest.approx([15.045, 59])
    assert result["stop"]["offsetMetres"] < 2
    features = result["geojson"]["features"]
    assert [f["properties"]["progress"] for f in features] == [
        "walked",
        "walked",
        "walked",
        "remaining",
        "remaining",
    ]
    assert (
        features[2]["geometry"]["coordinates"][0][-1]
        == features[3]["geometry"]["coordinates"][0][0]
    )
    assert (
        features[0]["geometry"]["coordinates"][0][-1]
        != features[1]["geometry"]["coordinates"][0][0]
    )


def test_stop_rejects_missing_stage_and_far_coordinates() -> None:
    with pytest.raises(ValueError, match="stage not found"):
        split_at_stop(sample(), 59, 15.04, "99")
    with pytest.raises(ValueError, match="more than 1 km"):
        split_at_stop(sample(), 63, 18, "11")
    with pytest.raises(ValueError, match="Invalid"):
        split_at_stop(sample(), float("nan"), 15, "11")


def test_stop_can_find_stage_and_follow_reverse_travel_without_connecting_gaps() -> None:
    route = sample()
    route["start"] = [15.06, 59]
    result = split_at_stop(route, 59, 15.045)
    assert result["stop"]["stage"] == "11"
    features = result["geojson"]["features"]
    assert features[0]["properties"]["stage"] == "12"
    assert features[0]["properties"]["progress"] == "walked"
    assert features[0]["geometry"]["coordinates"][0][0] == [15.06, 59]
    assert features[-1]["properties"]["stage"] == "10"
    assert features[-1]["properties"]["progress"] == "remaining"
    assert len(features[-1]["geometry"]["coordinates"]) == 1
    assert len(route["geojson"]["features"][0]["geometry"]["coordinates"]) == 2
