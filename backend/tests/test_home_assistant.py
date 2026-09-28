from types import SimpleNamespace
from unittest.mock import patch

from vision_app.home_assistant import HomeAssistantController


def _settings():
    return SimpleNamespace(home_alert_cooldown_seconds=0, home_assistant_event="vision_guard_fall",
                           home_assistant_url="https://ha.example", home_assistant_token="token")


def _fall(track_id: int, alert: bool = True):
    return {"trackId": track_id, "fall": {"alert": alert}}


def test_confirmed_fall_fires_once_until_recovery(monkeypatch):
    controller = HomeAssistantController()
    monkeypatch.setattr("vision_app.home_assistant.settings", _settings())
    with patch.object(controller, "fire_event") as fire_event:
        first = controller.handle([_fall(4)], "camera-1")
        second = controller.handle([_fall(4)], "camera-1")
        controller.handle([_fall(4, False)], "camera-1")
        third = controller.handle([_fall(4)], "camera-1")
    assert first["status"] == third["status"] == "executed"
    assert second["status"] == "active"
    assert fire_event.call_count == 2
    assert fire_event.call_args.args[0]["track_ids"] == [4]


def test_unconfirmed_pose_does_not_fire(monkeypatch):
    controller = HomeAssistantController()
    monkeypatch.setattr("vision_app.home_assistant.settings", _settings())
    with patch.object(controller, "fire_event") as fire_event:
        result = controller.handle([_fall(2, False)], "camera-1")
    assert result["status"] == "idle"
    fire_event.assert_not_called()
