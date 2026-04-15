"""
MCP tools — IoT functions exposed to the Gemini agent.
Each function here is a callable tool. Hardware is tried first;
simulation engine is always updated so the dashboard stays in sync.
"""

import logging
import os
import requests

logger = logging.getLogger(__name__)

DEVICE_API_URL = os.environ.get("DEVICE_API_URL", "http://localhost:8080")
DEVICE_API_KEY  = os.environ.get("DEVICE_API_KEY", "")

_hw_headers = {"Authorization": f"Bearer {DEVICE_API_KEY}"} if DEVICE_API_KEY else {}


def _hw(method: str, path: str, body: dict = None):
    """Try real hardware. Returns (data, 'hardware') or (None, 'simulation')."""
    try:
        r = requests.request(
            method,
            f"{DEVICE_API_URL}{path}",
            json=body,
            headers=_hw_headers,
            timeout=4,
        )
        r.raise_for_status()
        return r.json(), "hardware"
    except Exception:
        return None, "simulation"


# ── Device control ────────────────────────────────────────────────────────────

def control_device(device_id: str, command: str, params: dict = None) -> dict:
    """
    Control any smart home device.
    device_id: 'light' | 'fan' | 'pump' | 'camera'
    command:   'on' | 'off' | 'toggle'
    params:    optional e.g. {"brightness": 80} for lights, {"speed": 3} for fans
    """
    from simulation import engine as sim
    params = params or {}
    result, source = _hw("POST", f"/devices/{device_id}/control",
                          {"command": command, "params": params})
    topic = f"device/{device_id}"
    value = True if command == "on" else (False if command == "off" else command)
    sim.set_device(topic, value)
    sim.push_exec_log("gemini", f"{device_id} → {command}", "ok", source)
    if result:
        return {"ok": True, "device": device_id, "command": command,
                "source": source, "result": result}
    return {"ok": True, "device": device_id, "command": command,
            "source": "simulation", "state": value}


def get_device_state(device_id: str) -> dict:
    """Get current state of a device. device_id: light|fan|pump|camera|robot"""
    from simulation import engine as sim
    result, source = _hw("GET", f"/devices/{device_id}")
    if result:
        return {"device": device_id, "state": result, "source": source}
    state = sim.get_state()
    topic = f"device/{device_id}"
    if topic in state:
        return {"device": device_id, "state": state[topic], "source": "simulation"}
    return {"device": device_id, "state": None, "error": "Not found"}


def control_all_devices(command: str) -> dict:
    """Turn ALL devices on or off at once. command: 'on' | 'off'"""
    devices = ["light", "fan", "pump", "camera"]
    results = [control_device(d, command) for d in devices]
    return {"ok": True, "command": command, "results": results}


# ── Robot ─────────────────────────────────────────────────────────────────────

def move_robot(command: str, params: dict = None) -> dict:
    """
    Control the robot.
    command: 'forward'|'backward'|'turn_left'|'turn_right'|'stop'|'patrol'
    params:  optional {"speed": 50, "duration": 2000, "angle": 90}
    """
    from simulation import engine as sim
    params = params or {}
    result, source = _hw("POST", "/robots/robot_1/move",
                          {"command": command, "params": params})
    sim.set_device("device/robot", command)
    sim.push_exec_log("gemini", f"robot → {command}", "ok", source)
    if result:
        return {"ok": True, "command": command, "source": source, "result": result}
    return {"ok": True, "command": command, "source": "simulation"}


# ── Sensors ───────────────────────────────────────────────────────────────────

def read_sensor(sensor_id: str) -> dict:
    """
    Read current sensor value.
    sensor_id: 'motion'|'temperature'|'moisture'|'door'|'light_level'
    """
    from simulation import engine as sim
    result, source = _hw("GET", f"/sensors/{sensor_id}")
    if result:
        value = result.get("value")
        sim.set_device(f"sensor/{sensor_id}", value)
        return {"sensor": sensor_id, "value": value,
                "unit": result.get("unit"), "source": source}
    state = sim.get_state()
    topic = f"sensor/{sensor_id}"
    if topic in state:
        return {"sensor": sensor_id, **state[topic], "source": "simulation"}
    return {"sensor": sensor_id, "value": None, "error": "Not found"}


def read_all_sensors() -> dict:
    """Read all sensors and return current values."""
    from simulation import engine as sim
    state = sim.get_state()
    sensors = {k: v for k, v in state.items() if k.startswith("sensor/")}
    return {"sensors": sensors, "source": "simulation"}


# ── Skills ────────────────────────────────────────────────────────────────────

BUILTIN_SKILLS = {
    "morning_routine":  [("light", "on"), ("fan", "off")],
    "bedtime_mode":     [("light", "off"), ("fan", "off"), ("camera", "off")],
    "security_sweep":   [("camera", "on"), ("light", "on")],
    "welcome_home":     [("light", "on"), ("fan", "on")],
    "water_plants":     [("pump", "on")],
    "energy_saver":     [("light", "off"), ("fan", "off"), ("pump", "off")],
}


def run_skill(skill_name: str, params: dict = None) -> dict:
    """
    Execute a named automation skill.
    skill_name: 'morning_routine'|'bedtime_mode'|'security_sweep'|
                'welcome_home'|'water_plants'|'energy_saver'
    """
    from simulation import engine as sim
    params = params or {}
    result, source = _hw("POST", f"/skills/{skill_name}/run", {"params": params})
    sim.push_exec_log("gemini", f"skill/{skill_name}", "ok", str(params))
    if result:
        return {"ok": True, "skill": skill_name, "source": source, "result": result}
    if skill_name in BUILTIN_SKILLS:
        for device_id, cmd in BUILTIN_SKILLS[skill_name]:
            control_device(device_id, cmd)
        return {"ok": True, "skill": skill_name, "source": "simulation",
                "actions": BUILTIN_SKILLS[skill_name]}
    return {"ok": False, "error": f"Skill '{skill_name}' not found"}


# ── Notification ──────────────────────────────────────────────────────────────

def send_notification(message: str) -> dict:
    """Send a notification to the user dashboard. message: text to display."""
    from simulation import engine as sim
    sim.push_notification(message)
    sim.push_exec_log("gemini", "notify", "ok", message)
    return {"ok": True, "message": message}


# ── Tool registry for Gemini function calling ─────────────────────────────────

TOOL_FUNCTIONS = {
    "control_device":    control_device,
    "get_device_state":  get_device_state,
    "control_all_devices": control_all_devices,
    "move_robot":        move_robot,
    "read_sensor":       read_sensor,
    "read_all_sensors":  read_all_sensors,
    "run_skill":         run_skill,
    "send_notification": send_notification,
}

# Gemini function declarations
GEMINI_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "control_device",
                "description": "Turn a smart home device on, off, or toggle it. Use for lights, fans, pumps, cameras.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "device_id": {"type": "string", "description": "Device ID: light, fan, pump, or camera"},
                        "command":   {"type": "string", "description": "on, off, or toggle"},
                        "params":    {"type": "object", "description": "Optional: {brightness: 0-100} for light, {speed: 1-5} for fan"},
                    },
                    "required": ["device_id", "command"],
                },
            },
            {
                "name": "get_device_state",
                "description": "Get the current on/off state of any device.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "device_id": {"type": "string", "description": "light, fan, pump, camera, or robot"},
                    },
                    "required": ["device_id"],
                },
            },
            {
                "name": "control_all_devices",
                "description": "Turn ALL devices on or off simultaneously.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "on or off"},
                    },
                    "required": ["command"],
                },
            },
            {
                "name": "move_robot",
                "description": "Move or control the robot. Use for movement, patrol, stopping.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "forward, backward, turn_left, turn_right, stop, or patrol"},
                        "params":  {"type": "object", "description": "Optional: {speed: 0-100, duration: ms, angle: degrees}"},
                    },
                    "required": ["command"],
                },
            },
            {
                "name": "read_sensor",
                "description": "Read the current value of a sensor.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sensor_id": {"type": "string", "description": "motion, temperature, moisture, door, or light_level"},
                    },
                    "required": ["sensor_id"],
                },
            },
            {
                "name": "read_all_sensors",
                "description": "Read all sensors at once and return all current values.",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "run_skill",
                "description": "Execute a named automation routine. Use for common multi-device scenarios.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {"type": "string", "description": "morning_routine, bedtime_mode, security_sweep, welcome_home, water_plants, or energy_saver"},
                        "params":     {"type": "object", "description": "Optional skill parameters"},
                    },
                    "required": ["skill_name"],
                },
            },
            {
                "name": "send_notification",
                "description": "Send a notification message to the user's dashboard.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string", "description": "The notification text"},
                    },
                    "required": ["message"],
                },
            },
        ]
    }
]
