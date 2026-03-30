from __future__ import annotations

import random
import threading
import time
from queue import Queue


class SimulationEngine:
    def __init__(self):
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self.events: Queue[dict] = Queue()
        self.state = {
            "temperature": 24.0,
            "humidity": 50.0,
            "light_1": "off",
            "fan_1": "off",
            "robot_1": "idle",
        }

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=1)

    def snapshot(self):
        with self._lock:
            return dict(self.state)

    def set_device_state(self, device_id: str, value):
        with self._lock:
            self.state[device_id] = value
        self.events.put({"type": "device_update", "device": device_id, "value": value})

    def _loop(self):
        while self._running:
            with self._lock:
                self.state["temperature"] = round(self.state["temperature"] + random.uniform(-0.3, 0.3), 2)
                self.state["humidity"] = round(self.state["humidity"] + random.uniform(-0.5, 0.5), 2)
                payload = {
                    "type": "sensor_update",
                    "temperature": self.state["temperature"],
                    "humidity": self.state["humidity"],
                }
            self.events.put(payload)
            time.sleep(1)
