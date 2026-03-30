from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Device:
    id: str
    name: str
    state: str = "off"


@dataclass
class Light(Device):
    brightness: int = 0


@dataclass
class Fan(Device):
    speed: int = 0


@dataclass
class Robot(Device):
    mode: str = "idle"


@dataclass
class TemperatureSensor:
    id: str
    name: str
    value: float = 25.0


@dataclass
class HumiditySensor:
    id: str
    name: str
    value: float = 50.0
