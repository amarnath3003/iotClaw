from __future__ import annotations

from threading import Lock


class StateManager:
    """Thread-safe in-memory state map for live sensor/device values."""

    def __init__(self):
        self._lock = Lock()
        self._state: dict[str, float | int | str | bool | None] = {}

    def get_state(self, key: str | None):
        if not key:
            return None
        with self._lock:
            return self._state.get(key)

    def set_state(self, key: str, value):
        with self._lock:
            self._state[key] = value

    def all_states(self) -> dict[str, float | int | str | bool | None]:
        with self._lock:
            return dict(self._state)
