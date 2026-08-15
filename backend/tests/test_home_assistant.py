from unittest.mock import patch
from types import SimpleNamespace

from vision_app.home_assistant import HomeAssistantController


def _hand(gesture: str) -> dict:
    return {"gesture": gesture}


def _settings(hold_frames: int):
    return SimpleNamespace(
        home_gesture_hold_frames=hold_frames,
        home_gesture_cooldown_seconds=0,
        home_assistant_entity_id="switch.t1_chieu_sang_switch_3",
        home_assistant_url="https://ha.example",
        home_assistant_token="token",
    )


def test_gesture_must_be_stable_and_is_latched(monkeypatch):
    controller = HomeAssistantController()
    monkeypatch.setattr("vision_app.home_assistant.settings", _settings(2))

    with patch.object(controller, "call_service") as call_service:
        first = controller.handle([_hand("Thumb_Up")], "camera-1")
        second = controller.handle([_hand("Thumb_Up")], "camera-1")
        third = controller.handle([_hand("Thumb_Up")], "camera-1")

    assert first["status"] == "waiting"
    assert second["status"] == "executed"
    assert third["status"] == "waiting"
    call_service.assert_called_once_with(
        "switch", "turn_on", "switch.t1_chieu_sang_switch_3"
    )


def test_new_gesture_can_execute_after_previous_gesture(monkeypatch):
    controller = HomeAssistantController()
    monkeypatch.setattr("vision_app.home_assistant.settings", _settings(1))

    with patch.object(controller, "call_service") as call_service:
        controller.handle([_hand("Thumb_Up")], "camera-1")
        result = controller.handle([_hand("Thumb_Down")], "camera-1")

    assert result["status"] == "executed"
    assert result["action"] == "scene.turn_on"
    assert result["entityId"] == "scene.xuong_cua"
    assert call_service.call_count == 2


def test_door_gestures_activate_the_expected_scenes(monkeypatch):
    controller = HomeAssistantController()
    monkeypatch.setattr("vision_app.home_assistant.settings", _settings(1))

    with patch.object(controller, "call_service") as call_service:
        opened = controller.handle([_hand("Open_Palm")], "open-session")
        stopped = controller.handle([_hand("Closed_Fist")], "stop-session")

    assert opened["entityId"] == "scene.open_door"
    assert stopped["entityId"] == "scene.dung_cua"
    assert call_service.call_args_list[0].args == ("scene", "turn_on", "scene.open_door")
    assert call_service.call_args_list[1].args == ("scene", "turn_on", "scene.dung_cua")
