"""
Simulation engine — virtual sensors and devices.
Runs in a background thread, ticks every 2s,
updates state_store, pushes events for the execution engine.
"""
import threading, time, random, math
from datetime import datetime

_lock = threading.Lock()

state_store = {
    "sensor/motion":      {"value": False,  "unit": "bool",  "label": "Motion"},
    "sensor/temperature": {"value": 22.0,   "unit": "C",     "label": "Temperature"},
    "sensor/moisture":    {"value": 55.0,   "unit": "%",     "label": "Soil moisture"},
    "sensor/door":        {"value": False,  "unit": "bool",  "label": "Door"},
    "sensor/light_level": {"value": 400.0,  "unit": "lux",   "label": "Light level"},
    "device/light":       {"value": False,  "unit": "bool",  "label": "Light",      "controllable": True},
    "device/fan":         {"value": False,  "unit": "bool",  "label": "Fan",        "controllable": True},
    "device/pump":        {"value": False,  "unit": "bool",  "label": "Pump",       "controllable": True},
    "device/camera":      {"value": False,  "unit": "bool",  "label": "Camera",     "controllable": True},
    "device/robot":       {"value": "idle", "unit": "state", "label": "Robot",      "controllable": True},
}

event_queue      = []
exec_log         = []
notifications     = []
_simulation_mode  = True   # becomes False when real hardware sends a message


def get_simulation_mode() -> bool:
    with _lock:
        return _simulation_mode


def set_device_dynamic(topic: str, value, label: str = "",
                       unit: str = "", is_real: bool = True):
    """Add/update any device topic — used by real MQTT messages."""
    global _simulation_mode
    with _lock:
        if topic not in state_store:
            state_store[topic] = {}
        state_store[topic]["value"]      = value
        state_store[topic]["label"]      = label or topic.split("/")[-1]
        state_store[topic]["unit"]       = unit
        state_store[topic]["sim"]        = not is_real
        state_store[topic]["updated_at"] = datetime.now().isoformat()
        if is_real:
            _simulation_mode = False

def get_state():
    with _lock:
        return {k: dict(v) for k, v in state_store.items()}

def set_device(topic, value):
    with _lock:
        if topic in state_store:
            state_store[topic]["value"] = value
            state_store[topic]["updated_at"] = datetime.now().isoformat()
            return True
    return False

def push_event(topic, payload):
    with _lock:
        event_queue.append({"topic": topic, "payload": payload, "ts": datetime.now().isoformat()})
        if len(event_queue) > 300:
            event_queue.pop(0)

def drain_events():
    with _lock:
        evts = list(event_queue)
        event_queue.clear()
        return evts

def push_exec_log(workflow_name, action, status, detail="", source=""):
    with _lock:
        exec_log.append({
            "ts":       datetime.now().isoformat(),
            "workflow": workflow_name,
            "action":   action,
            "status":   status,
            "detail":   detail,
            "source":   source,
        })
        if len(exec_log) > 500:
            exec_log.pop(0)

    # Also persist to SQLite
    try:
        from core.device_registry import log_execution
        log_execution(workflow_name, action, status, detail, source)
    except Exception:
        pass

def get_exec_log():
    with _lock:
        return list(reversed(exec_log))

def push_notification(msg):
    with _lock:
        notifications.append({"ts": datetime.now().isoformat(), "message": msg})
        if len(notifications) > 50:
            notifications.pop(0)

def get_notifications():
    with _lock:
        return list(reversed(notifications))

_tick = 0

def _simulate():
    global _tick
    _tick += 1
    t = _tick
    with _lock:
        old_temp = state_store["sensor/temperature"]["value"]
        new_temp = round(26 + 8 * math.sin(t / 30), 1)
        state_store["sensor/temperature"]["value"] = new_temp
        if abs(new_temp - old_temp) > 0.5:
            event_queue.append({"topic": "sensor/temperature", "payload": str(new_temp), "ts": datetime.now().isoformat()})

        m = state_store["sensor/moisture"]["value"]
        pump_on = state_store["device/pump"]["value"]
        m = min(100.0, m + 3.0) if pump_on else max(10.0, m - random.uniform(0.3, 0.8))
        state_store["sensor/moisture"]["value"] = round(m, 1)

        lux = max(0, round(600 * math.sin(math.pi * ((t % 144) / 144)), 1))
        state_store["sensor/light_level"]["value"] = lux

        motion = (t % 23 == 0) or (random.random() < 0.04)
        old_motion = state_store["sensor/motion"]["value"]
        state_store["sensor/motion"]["value"] = motion
        if motion and not old_motion:
            event_queue.append({"topic": "sensor/motion", "payload": "detected", "ts": datetime.now().isoformat()})

        if t % 41 == 0:
            door = random.choice([True, False])
            old_door = state_store["sensor/door"]["value"]
            state_store["sensor/door"]["value"] = door
            if door != old_door:
                event_queue.append({"topic": "sensor/door", "payload": "open" if door else "closed", "ts": datetime.now().isoformat()})

        while len(event_queue) > 300:
            event_queue.pop(0)

_running = False

def _try_broadcast():
    """Non-blocking attempt to push state over WebSocket after each tick."""
    try:
        import asyncio, importlib
        main_mod = importlib.import_module("main")
        manager  = getattr(main_mod, "ws_manager", None)
        if not manager or not manager._conns:
            return
        loop = getattr(main_mod, "_event_loop", None)
        if loop is None or loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": "state",
                "data": get_state(),
                "sim_mode": _simulation_mode,
            }),
            loop,
        )
    except Exception:
        pass   # WebSocket not ready yet or no clients — silently skip

def start():
    global _running
    if _running:
        return
    _running = True
    def loop():
        while _running:
            _simulate()
            _try_broadcast()
            time.sleep(2)
    threading.Thread(target=loop, daemon=True).start()

def stop():
    global _running
    _running = False
