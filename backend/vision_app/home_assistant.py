"""Send de-duplicated, confirmed fall events to Home Assistant."""
from __future__ import annotations

import json
from threading import Lock
from time import monotonic
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import settings


class HomeAssistantController:
    def __init__(self) -> None:
        self._active_tracks: dict[str, set[int]] = {}
        self._last_alert_at: dict[str, float] = {}
        self._lock = Lock()

    @property
    def configured(self) -> bool:
        return bool(settings.home_assistant_url and settings.home_assistant_token)

    def handle(self, falls: list[dict[str, Any]], tracking_id: str | None) -> dict[str, Any]:
        """Fire once when a track becomes confirmed; re-arm after recovery."""
        session = tracking_id or "single-frame"
        confirmed = {int(item["trackId"]) for item in falls
                     if item.get("trackId") is not None and item.get("fall", {}).get("alert")}
        with self._lock:
            previous = self._active_tracks.get(session, set())
            new_tracks = confirmed - previous
            self._active_tracks[session] = confirmed
            last = self._last_alert_at.get(session, 0.0)
            if not new_tracks:
                return {"enabled": True, "configured": self.configured,
                        "status": "active" if confirmed else "idle"}
            if monotonic() - last < max(0.0, settings.home_alert_cooldown_seconds):
                return {"enabled": True, "configured": self.configured, "status": "cooldown"}
            self._last_alert_at[session] = monotonic()

        payload = {"source": "vision_guard", "camera_id": session,
                   "track_ids": sorted(new_tracks), "status": "confirmed"}
        try:
            self.fire_event(payload)
        except RuntimeError as error:
            return {"enabled": True, "configured": self.configured,
                    "status": "error", "message": str(error)}
        return {"enabled": True, "configured": True, "status": "executed",
                "event": settings.home_assistant_event, "trackIds": sorted(new_tracks)}

    def fire_event(self, payload: dict[str, Any]) -> None:
        if not self.configured:
            raise RuntimeError("Home Assistant chưa được cấu hình HA_URL và HA_TOKEN")
        request = Request(
            f"{settings.home_assistant_url}/api/events/{settings.home_assistant_event}",
            data=json.dumps(payload).encode("utf-8"), method="POST",
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
            raise RuntimeError(f"Không thể kết nối Home Assistant: {getattr(error, 'reason', error)}") from error


home_assistant_controller = HomeAssistantController()
