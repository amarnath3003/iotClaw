"""
Device registry - user-defined devices with real MQTT topics.
"""

import logging
import os
import sqlite3
import uuid
from typing import Optional

logger = logging.getLogger(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "openclaw.db")


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_device_tables():
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS devices (
            id             TEXT PRIMARY KEY,
            user_id        TEXT DEFAULT '',
            name           TEXT NOT NULL,
            device_type    TEXT NOT NULL,
            room           TEXT DEFAULT '',
            icon           TEXT DEFAULT '◎',
            is_sensor      INTEGER DEFAULT 0,
            mqtt_topic_get TEXT DEFAULT '',
            mqtt_topic_set TEXT DEFAULT '',
            unit           TEXT DEFAULT '',
            notes          TEXT DEFAULT '',
            created_at     TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS rooms (
            id      TEXT PRIMARY KEY,
            user_id TEXT DEFAULT '',
            name    TEXT NOT NULL,
            icon    TEXT DEFAULT '◎'
        );
        CREATE TABLE IF NOT EXISTS exec_log_persistent (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            ts       TEXT DEFAULT (datetime('now')),
            workflow TEXT DEFAULT '',
            action   TEXT DEFAULT '',
            status   TEXT DEFAULT 'ok',
            detail   TEXT DEFAULT '',
            source   TEXT DEFAULT 'simulation'
        );
    """)
    conn.commit(); conn.close()


def get_devices_for_user(user_id: str = "") -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM devices WHERE user_id=? OR user_id='' ORDER BY room, name",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_device(device_id: str) -> Optional[dict]:
    conn = _conn()
    row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_device(data: dict, user_id: str = "") -> dict:
    did = str(uuid.uuid4())
    conn = _conn()
    conn.execute("""
        INSERT INTO devices
          (id,user_id,name,device_type,room,icon,is_sensor,
           mqtt_topic_get,mqtt_topic_set,unit,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (did, user_id, data["name"], data["device_type"],
          data.get("room", ""), data.get("icon", "◎"),
          int(data.get("is_sensor", False)),
          data.get("mqtt_topic_get", ""), data.get("mqtt_topic_set", ""),
          data.get("unit", ""), data.get("notes", "")))
    conn.commit()
    row = conn.execute("SELECT * FROM devices WHERE id=?", (did,)).fetchone()
    conn.close()
    return dict(row)


def update_device(device_id: str, data: dict) -> Optional[dict]:
    conn = _conn()
    conn.execute("""
        UPDATE devices SET name=?,device_type=?,room=?,icon=?,is_sensor=?,
          mqtt_topic_get=?,mqtt_topic_set=?,unit=?,notes=?
        WHERE id=?
    """, (data["name"], data["device_type"], data.get("room", ""),
          data.get("icon", "◎"), int(data.get("is_sensor", False)),
          data.get("mqtt_topic_get", ""), data.get("mqtt_topic_set", ""),
          data.get("unit", ""), data.get("notes", ""), device_id))
    conn.commit()
    row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_device(device_id: str):
    conn = _conn()
    conn.execute("DELETE FROM devices WHERE id=?", (device_id,))
    conn.commit(); conn.close()


def get_rooms(user_id: str = "") -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM rooms WHERE user_id=? OR user_id='' ORDER BY name",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_room(name: str, icon: str = "◎", user_id: str = "") -> dict:
    rid = str(uuid.uuid4())
    conn = _conn()
    conn.execute("INSERT INTO rooms (id,user_id,name,icon) VALUES (?,?,?,?)",
                 (rid, user_id, name, icon))
    conn.commit(); conn.close()
    return {"id": rid, "user_id": user_id, "name": name, "icon": icon}


def log_execution(workflow: str, action: str, status: str,
                  detail: str = "", source: str = "simulation"):
    """Write one execution log row to SQLite (persistent across restarts)."""
    conn = _conn()
    conn.execute("""
        INSERT INTO exec_log_persistent (workflow,action,status,detail,source)
        VALUES (?,?,?,?,?)
    """, (workflow, action, status, detail, source))
    conn.commit(); conn.close()


def get_exec_log_persistent(limit: int = 100) -> list:
    conn = _conn()
    rows = conn.execute(
        "SELECT * FROM exec_log_persistent ORDER BY ts DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def build_ai_device_context(user_id: str = "") -> str:
    """
    Returns a string injected into the Gemini system prompt listing
    the user's real registered devices. Falls back to sim device list.
    """
    devices = get_devices_for_user(user_id)
    if not devices:
        return (
            "No devices registered yet. "
            "Tell the user to go to the Devices view to add their first device. "
            "For now, simulation devices are available: "
            "light, fan, pump, camera (devices) | "
            "motion, temperature, moisture, door, light_level (sensors)."
        )
    actuators = [d for d in devices if not d["is_sensor"]]
    sensors = [d for d in devices if d["is_sensor"]]
    lines = []
    if actuators:
        lines.append("Controllable devices (use these IDs in actions):")
        for d in actuators:
            room = f" [{d['room']}]" if d["room"] else ""
            lines.append(f"  - {d['id']}: {d['name']}{room} "
                         f"(set topic: {d['mqtt_topic_set'] or 'none'})")
    if sensors:
        lines.append("Sensors (use sensor_id when reading):")
        for d in sensors:
            room = f" [{d['room']}]" if d["room"] else ""
            lines.append(f"  - {d['id']}: {d['name']}{room} "
                         f"(get topic: {d['mqtt_topic_get'] or 'none'}, "
                         f"unit: {d['unit'] or '?'})")
    return "\n".join(lines)