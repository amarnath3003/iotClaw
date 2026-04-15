import random
import threading
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from backend.mqtt.broker import mqtt_broker
from config.settings import settings

logger = logging.getLogger(__name__)


# ── Base Device ────────────────────────────────────────────────────────────────

@dataclass
class SimulatedDevice:
    device_id: str
    name: str
    state: dict = field(default_factory=dict)

    def publish(self, topic: str, payload: dict):
        mqtt_broker.publish(topic, payload)

    def on(self):
        pass

    def off(self):
        pass


# ── Sensors ───────────────────────────────────────────────────────────────────

class MotionSensor(SimulatedDevice):
    """Randomly fires motion events every tick."""

    def tick(self):
        detected = random.random() < 0.3  # 30% chance each tick
        payload = {"device_id": self.device_id, "detected": detected}
        self.state["detected"] = detected
        self.publish(f"sensors/motion/{self.device_id}", payload)
        if detected:
            logger.debug(f"[SIM] Motion detected: {self.device_id}")


class TemperatureSensor(SimulatedDevice):
    """Simulates a temperature reading that drifts over time."""

    def __init__(self, device_id: str, name: str, base_temp: float = 25.0):
        super().__init__(device_id, name, state={"temperature": base_temp})
        self._base_temp = base_temp

    def tick(self):
        drift = random.uniform(-0.5, 0.5)
        self.state["temperature"] = round(self._base_temp + drift, 1)
        payload = {"device_id": self.device_id, "temperature": self.state["temperature"], "unit": "C"}
        self.publish(f"sensors/temperature/{self.device_id}", payload)
        logger.debug(f"[SIM] Temp: {self.state['temperature']}°C ({self.device_id})")


class SoilMoistureSensor(SimulatedDevice):
    """Simulates soil moisture that decreases over time and resets when the pump runs."""

    def __init__(self, device_id: str, name: str):
        super().__init__(device_id, name, state={"moisture_percent": 60.0})

    def tick(self):
        self.state["moisture_percent"] = max(0.0, round(self.state["moisture_percent"] - random.uniform(0, 1.5), 1))
        payload = {"device_id": self.device_id, "moisture_percent": self.state["moisture_percent"]}
        self.publish(f"sensors/moisture/{self.device_id}", payload)
        logger.debug(f"[SIM] Moisture: {self.state['moisture_percent']}% ({self.device_id})")

    def refill(self):
        self.state["moisture_percent"] = 80.0


# ── Actuators ─────────────────────────────────────────────────────────────────

class Light(SimulatedDevice):
    def __init__(self, device_id: str, name: str):
        super().__init__(device_id, name, state={"on": False, "brightness": 100})

    def on(self, brightness: int = 100):
        self.state["on"] = True
        self.state["brightness"] = brightness
        self.publish(f"devices/light/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Light ON at {brightness}% brightness ({self.device_id})")

    def off(self):
        self.state["on"] = False
        self.publish(f"devices/light/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Light OFF ({self.device_id})")


class Fan(SimulatedDevice):
    def __init__(self, device_id: str, name: str):
        super().__init__(device_id, name, state={"on": False, "speed": 0})

    def on(self, speed: int = 3):
        self.state["on"] = True
        self.state["speed"] = speed
        self.publish(f"devices/fan/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Fan ON speed={speed} ({self.device_id})")

    def off(self):
        self.state["on"] = False
        self.state["speed"] = 0
        self.publish(f"devices/fan/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Fan OFF ({self.device_id})")


class Robot(SimulatedDevice):
    def __init__(self, device_id: str, name: str):
        super().__init__(device_id, name, state={"moving": False, "direction": "idle", "obstacle": False})

    def move(self, direction: str):
        self.state["moving"] = True
        self.state["direction"] = direction
        self.publish(f"devices/robot/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Robot moving: {direction} ({self.device_id})")

    def stop(self):
        self.state["moving"] = False
        self.state["direction"] = "idle"
        self.publish(f"devices/robot/{self.device_id}/state", self.state)
        logger.info(f"[SIM] Robot stopped ({self.device_id})")

    def detect_obstacle(self):
        self.state["obstacle"] = random.random() < 0.2
        self.publish(f"sensors/obstacle/{self.device_id}", {"obstacle": self.state["obstacle"]})
