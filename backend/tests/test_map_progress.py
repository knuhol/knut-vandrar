"""Stopping fixes locate the correct GPX segment and edge."""

from typing import Any

import pytest

from knut_vandrar_backend.maps.progress import orient_features, project_stop


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


def test_stop_locates_the_selected_stage_and_segment() -> None:
    stop = project_stop(orient_features(sample()), 59.00001, 15.045, "11")
    assert stop["coordinates"] == pytest.approx([15.045, 59])
    assert (stop["line"], stop["edge"]) == (2, 1)


def test_stop_rejects_missing_stage_and_far_coordinates() -> None:
    features = orient_features(sample())
    with pytest.raises(ValueError, match="stage not found"):
        project_stop(features, 59, 15.04, "99")
    with pytest.raises(ValueError, match="more than 1 km"):
        project_stop(features, 63, 18, "11")
    with pytest.raises(ValueError, match="Invalid"):
        project_stop(features, float("nan"), 15, "11")


def test_stop_follows_reverse_travel_without_connecting_gaps() -> None:
    route = sample()
    route["start"] = [15.06, 59]
    features = orient_features(route)
    stop = project_stop(features, 59, 15.045)
    assert stop["coordinates"] == pytest.approx([15.045, 59])
    assert (stop["line"], stop["edge"]) == (1, 0)
    assert len(features[-1]["geometry"]["coordinates"]) == 2
