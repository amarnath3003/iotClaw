from __future__ import annotations

from typing import Callable

import paho.mqtt.client as mqtt


class MQTTBroker:
    def __init__(self, host: str, port: int, on_message: Callable[[str, str], None]):
        self.host = host
        self.port = port
        self.on_message_callback = on_message
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.client.on_message = self._on_message

    def connect(self):
        self.client.connect(self.host, self.port, 60)
        self.client.loop_start()

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def subscribe(self, topic: str):
        self.client.subscribe(topic)

    def publish(self, topic: str, payload: str):
        self.client.publish(topic, payload)

    def _on_message(self, _client, _userdata, msg):
        payload = msg.payload.decode("utf-8", errors="ignore")
        self.on_message_callback(msg.topic, payload)
