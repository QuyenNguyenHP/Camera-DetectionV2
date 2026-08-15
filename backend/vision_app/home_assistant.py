"""Map recognized hand gestures to Home Assistant service calls.

Edit GESTURE_ACTIONS below to choose your own gestures, entities and services.
An empty ``entity_id`` uses HA_ENTITY_ID from .env.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import settings


# MediaPipe canned names include: Closed_Fist, Open_Palm, Pointing_Up,
# Thumb_Down, Thumb_Up, Victory and ILoveYou.
GESTURE_ACTIONS: dict[str, dict[str, str]] = {
    "Thumb_Up": {
        "domain": "switch",
        "service": "turn_on",
        "entity_id": "switch.t1_chieu_sang_switch_3",
    },
    "Open_Palm": {
        "domain": "scene",
        "service": "turn_on",
        "entity_id": "scene.open_door",
    },
    "Closed_Fist": {
        "domain": "scene",
        "service": "turn_on",
        "entity_id": "scene.stop_door",
    },
    "Thumb_Down": {
        "domain": "scene",
        "service": "turn_on",
        "entity_id": "scene.close_door",
    },
}


@dataclass
class _GestureState:
    gesture: str = ""
    frames: int = 0
    latched: bool = False
    last_action_at: float = 0.0


class HomeAssistantController:
    def __init__(self) -> None:
        self._states: dict[str, _GestureState] = {}
        self._lock = Lock()

    @property
    def configured(self) -> bool:
        return bool(settings.home_assistant_url and settings.home_assistant_token)

    def handle(self, hands: list[dict[str, Any]], tracking_id: str | None) -> dict[str, Any]:
        """Execute at most one action after a gesture is held for several frames."""
        session = tracking_id or "single-frame"
        gesture = next(
            (hand.get("gesture", "") for hand in hands if hand.get("gesture") in GESTURE_ACTIONS),
            "",
        )
        with self._lock:
            state = self._states.setdefault(session, _GestureState())
            if gesture != state.gesture:
                state.gesture = gesture
                state.frames = 1 if gesture else 0
                state.latched = False
            elif gesture:
                state.frames += 1
            ready = (
                bool(gesture)
                and state.frames >= max(1, settings.home_gesture_hold_frames)
                and not state.latched
                and monotonic() - state.last_action_at >= max(0.0, settings.home_gesture_cooldown_seconds)
            )
            if not ready:
                return {"enabled": True, "configured": self.configured, "gesture": gesture or None,
                        "status": "waiting" if gesture else "idle"}
            state.latched = True
            state.last_action_at = monotonic()

        action = GESTURE_ACTIONS[gesture]
        entity_id = action.get("entity_id") or settings.home_assistant_entity_id
        try:
            self.call_service(action["domain"], action["service"], entity_id)
        except RuntimeError as error:
            return {"enabled": True, "configured": self.configured, "gesture": gesture,
                    "status": "error", "message": str(error)}
        return {"enabled": True, "configured": True, "gesture": gesture, "status": "executed",
                "action": f'{action["domain"]}.{action["service"]}', "entityId": entity_id}

    def call_service(self, domain: str, service: str, entity_id: str) -> None:
        if not self.configured:
            raise RuntimeError("Home Assistant chưa được cấu hình HA_URL và HA_TOKEN")
        if not entity_id:
            raise RuntimeError("Chưa cấu hình entity_id cho thao tác Home Assistant")
        request = Request(
            f"{settings.home_assistant_url}/api/services/{domain}/{service}",
            data=json.dumps({"entity_id": entity_id}).encode("utf-8"), method="POST",
            headers={"Authorization": f"Bearer {settings.home_assistant_token}",
                     "Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=5) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f"Home Assistant trả về HTTP {response.status}")
        except HTTPError as error:
            raise RuntimeError(f"Home Assistant trả về HTTP {error.code}") from error
        except (URLError, TimeoutError) as error:
            reason = getattr(error, "reason", str(error))
            raise RuntimeError(f"Không thể kết nối Home Assistant: {reason}") from error


home_assistant_controller = HomeAssistantController()
