import logging
from typing import Any, Dict
from backend.mqtt.broker import mqtt_broker

logger = logging.getLogger(__name__)


class StateManager:
    """
    Maintains the latest known state of every device and sensor.
    Subscribes to all MQTT topics and updates state on each message.
    The execution engine queries this during condition evaluation.
    """

    def __init__(self):
        self._state: Dict[str, Any] = {}

    def start(self):
        mqtt_broker.subscribe("sensors/#", self._handle_sensor)
        mqtt_broker.subscribe("devices/#", self._handle_device)
        logger.info("StateManager listening on sensors/# and devices/#")

    def _handle_sensor(self, topic: str, payload: dict):
        key = topic.replace("/", ".")
        self._state[key] = payload
        logger.debug(f"State updated [{key}]: {payload}")

    def _handle_device(self, topic: str, payload: dict):
        key = topic.replace("/", ".")
        self._state[key] = payload
        logger.debug(f"State updated [{key}]: {payload}")

    def get(self, key: str, default=None) -> Any:
        """Get a state value by dotted key, e.g. 'sensors.temperature.temp_main'"""
        return self._state.get(key, default)

    def get_all(self) -> Dict[str, Any]:
        return dict(self._state)

    def set(self, key: str, value: Any):
        """Manually set a state value (used by execution engine after actions)."""
        self._state[key] = value


# Singleton
state_manager = StateManager()
