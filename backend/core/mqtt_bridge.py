"""
MQTT Bridge — real hardware connection via paho-mqtt.
Silently disabled if MQTT_HOST is empty or broker unreachable.
"""
import logging, os, threading

logger     = logging.getLogger(__name__)
_client    = None
_connected = False

MQTT_HOST = os.environ.get("MQTT_HOST", "")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_USER = os.environ.get("MQTT_USER", "")
MQTT_PASS = os.environ.get("MQTT_PASS", "")

def _on_connect(client, userdata, flags, rc):
    global _connected
    if rc == 0:
        _connected = True
        client.subscribe("#")
        logger.info(f"[MQTT] Connected to {MQTT_HOST}:{MQTT_PORT}")
    else:
        logger.warning(f"[MQTT] Connection refused rc={rc}")

def _on_disconnect(client, userdata, rc):
    global _connected
    _connected = False
    logger.warning(f"[MQTT] Disconnected rc={rc}")

def _on_message(client, userdata, msg):
    try:
        from simulation import engine as sim
        topic   = msg.topic
        payload = msg.payload.decode("utf-8", errors="replace").strip()
        # Push into execution engine event queue — same as simulation events
        sim.push_event(topic, payload)
        # Try to update state store if topic matches a registered device
        try:
            import sqlite3, os as _os
            db = sqlite3.connect(
                _os.path.join(_os.path.dirname(__file__), "..", "openclaw.db"))
            db.row_factory = sqlite3.Row
            rows = db.execute(
                "SELECT * FROM devices WHERE mqtt_topic_get=?", (topic,)
            ).fetchall()
            db.close()
            for row in rows:
                val = _parse(payload)
                key = f"{'sensor' if row['is_sensor'] else 'device'}/{row['id']}"
                sim.set_device_dynamic(key, val, row["name"],
                                       row["unit"] or "", is_real=True)
        except Exception:
            pass
        logger.debug(f"[MQTT] {topic} = {payload[:80]}")
    except Exception as e:
        logger.error(f"[MQTT] handler error: {e}")

def _parse(payload: str):
    p = payload.strip().upper()
    if p in ("ON","TRUE","1","OPEN","DETECTED","ACTIVE"): return True
    if p in ("OFF","FALSE","0","CLOSED","CLEAR","INACTIVE"): return False
    try: return float(payload)
    except Exception: return payload

def publish(topic: str, payload: str) -> bool:
    if not _connected or not _client:
        return False
    try:
        _client.publish(topic, payload)
        logger.info(f"[MQTT] Published {topic} = {payload}")
        return True
    except Exception as e:
        logger.error(f"[MQTT] Publish error: {e}")
        return False

def is_connected() -> bool:
    return _connected

def start():
    global _client
    if not MQTT_HOST:
        logger.info("[MQTT] MQTT_HOST not set — bridge disabled, simulation only")
        return
    try:
        import paho.mqtt.client as mqtt
        c = mqtt.Client(client_id="openclaw-backend")
        c.on_connect    = _on_connect
        c.on_disconnect = _on_disconnect
        c.on_message    = _on_message
        if MQTT_USER:
            c.username_pw_set(MQTT_USER, MQTT_PASS)
        c.connect_async(MQTT_HOST, MQTT_PORT, keepalive=60)
        c.loop_start()
        _client = c
        logger.info(f"[MQTT] Bridge starting → {MQTT_HOST}:{MQTT_PORT}")
    except ImportError:
        logger.warning("[MQTT] paho-mqtt not installed — run: pip install paho-mqtt")
    except Exception as e:
        logger.warning(f"[MQTT] Bridge failed: {e} — simulation continues")