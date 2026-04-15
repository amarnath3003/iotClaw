import json
import threading
import logging
from typing import Callable, Dict, List
import paho.mqtt.client as mqtt
from config.settings import settings

logger = logging.getLogger(__name__)


class MQTTBroker:
    """
    Thin wrapper around paho-mqtt.
    - Connects to the broker on startup
    - Maintains a registry of topic → [callbacks]
    - Dispatches incoming messages to registered callbacks
    """

    def __init__(self):
        self._client = mqtt.Client(client_id="openclaw-backend")
        self._handlers: Dict[str, List[Callable]] = {}
        self._lock = threading.Lock()
        self._connected = False

        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

        if settings.mqtt_username:
            self._client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

    # ── Connection ─────────────────────────────────────────────────────────────

    def connect(self):
        try:
            self._client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
            self._client.loop_start()
            logger.info(f"MQTT connecting to {settings.mqtt_host}:{settings.mqtt_port}")
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")

    def disconnect(self):
        self._client.loop_stop()
        self._client.disconnect()
        logger.info("MQTT disconnected")

    # ── Pub / Sub ──────────────────────────────────────────────────────────────

    def subscribe(self, topic: str, callback: Callable[[str, dict], None]):
        """Register a callback for a topic. Wildcards (#, +) supported."""
        with self._lock:
            if topic not in self._handlers:
                self._handlers[topic] = []
                self._client.subscribe(topic)
                logger.debug(f"MQTT subscribed to: {topic}")
            self._handlers[topic].append(callback)

    def publish(self, topic: str, payload: dict):
        """Publish a JSON payload to a topic."""
        self._client.publish(topic, json.dumps(payload))

    # ── Internal callbacks ─────────────────────────────────────────────────────

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            logger.info("MQTT connected successfully")
            # Re-subscribe after reconnect
            with self._lock:
                for topic in self._handlers:
                    client.subscribe(topic)
        else:
            logger.error(f"MQTT connection refused, code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        logger.warning(f"MQTT disconnected (rc={rc}), will auto-reconnect")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            payload = {"raw": msg.payload.decode()}

        with self._lock:
            matched = [
                (t, cbs) for t, cbs in self._handlers.items()
                if mqtt.topic_matches_sub(t, topic)
            ]

        for _, callbacks in matched:
            for cb in callbacks:
                try:
                    cb(topic, payload)
                except Exception as e:
                    logger.error(f"MQTT handler error on topic '{topic}': {e}")

    @property
    def is_connected(self) -> bool:
        return self._connected


# Singleton instance used across the app
mqtt_broker = MQTTBroker()
