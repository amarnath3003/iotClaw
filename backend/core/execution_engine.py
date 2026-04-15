"""
Execution engine v2
- MQTT event triggers (sensor-based)
- Time / cron triggers (checked every 30s)
- run_skill action type
- Per-workflow last_fired throttle (prevents re-firing within 10s)
- Thread-safe, daemon threads
"""
import threading, time, json, logging
from datetime import datetime

logger = logging.getLogger(__name__)

_running      = False
_conn_factory = None
_last_fired   = {}   # wf_id → timestamp, prevents rapid re-firing
THROTTLE_SECS = 10

def _get_workflows():
    conn = _conn_factory()
    rows = conn.execute("SELECT * FROM workflows WHERE enabled=1").fetchall()
    conn.close()
    return rows

def _check_trigger(trigger, event):
    t = trigger.get("type", "manual")
    if t != "mqtt_event":
        return False
    if trigger.get("topic", "") != event.get("topic", ""):
        return False
    cond    = trigger.get("condition", "")
    payload = event.get("payload", "")
    if not cond:
        return True
    try:
        return bool(eval(cond,
            {"__builtins__": {"float": float, "int": int, "str": str, "bool": bool}},
            {"payload": payload}))
    except Exception:
        return payload == cond

def _check_time_trigger(trigger):
    t = trigger.get("type")
    if t != "time":
        return False
    cron = trigger.get("cron", "")
    if not cron:
        return False
    now = datetime.now()
    try:
        parts = cron.strip().split()
        if len(parts) >= 5:
            m_spec, h_spec = parts[0], parts[1]
            m_ok = (m_spec == "*" or m_spec.startswith("*/") and now.minute % int(m_spec[2:]) == 0
                    or m_spec.isdigit() and int(m_spec) == now.minute)
            h_ok = (h_spec == "*" or h_spec.startswith("*/") and now.hour % int(h_spec[2:]) == 0
                    or h_spec.isdigit() and int(h_spec) == now.hour)
            return m_ok and h_ok and now.second < 30
        if ":" in cron:
            h, m = map(int, cron.split(":"))
            return now.hour == h and now.minute == m and now.second < 30
    except Exception:
        pass
    return False

def _check_conditions(conditions, state):
    for cond in conditions:
        ctype = cond.get("type")
        if ctype == "time":
            now   = datetime.now().strftime("%H:%M")
            after = cond.get("after", "00:00")
            before = cond.get("before", "23:59")
            in_w  = (after <= now <= before) if after <= before else (now >= after or now <= before)
            if not in_w:
                return False
        elif ctype == "numeric":
            field  = cond.get("field", "")
            op     = cond.get("operator", "gt")
            thr    = float(cond.get("value", 0))
            actual = state.get(f"sensor/{field}", {}).get("value", 0)
            try:
                actual = float(actual)
            except Exception:
                return False
            if not {"gt": actual > thr, "lt": actual < thr,
                    "gte": actual >= thr, "lte": actual <= thr,
                    "eq": actual == thr}.get(op, False):
                return False
        elif ctype == "state":
            field  = cond.get("field", "")
            val    = str(cond.get("value", ""))
            actual = str(state.get(f"device/{field}", {}).get("value", ""))
            if actual != val:
                return False
    return True

def _throttle_ok(wid):
    last = _last_fired.get(wid, 0)
    if time.time() - last < THROTTLE_SECS:
        return False
    _last_fired[wid] = time.time()
    return True

def _execute_actions(actions, workflow_name):
    from simulation import engine as sim
    from core.mcp_tools import (control_device, move_robot,
                                 send_notification, run_skill)
    for action in actions:
        atype = action.get("type")
        try:
            if atype == "device_control":
                control_device(
                    device_id=action.get("device", ""),
                    command=action.get("command", "on"),
                    params=action.get("params"),
                )
            elif atype == "robot_move":
                move_robot(
                    command=action.get("command", "stop"),
                    params=action.get("params"),
                )
            elif atype == "run_skill":
                run_skill(
                    skill_name=action.get("skill", ""),
                    params=action.get("params"),
                )
            elif atype == "delay":
                secs = min(int(action.get("seconds", 1)), 60)
                time.sleep(secs)
                sim.push_exec_log(workflow_name, f"delay {secs}s", "ok")
            elif atype == "notify":
                send_notification(action.get("message", "Automation triggered"))
        except Exception as e:
            logger.error(f"[ENG] {workflow_name} · {atype}: {e}")
            from simulation import engine as sim2
            sim2.push_exec_log(workflow_name, atype, "error", str(e))

def _fire(row):
    wid  = row["id"]
    name = row["name"]
    if not _throttle_ok(wid):
        return
    try:
        actions = json.loads(row["actions_json"])
        logger.info(f"[ENG] Firing: {name}")
        t = threading.Thread(target=_execute_actions, args=(actions, name), daemon=True)
        t.start()
    except Exception as e:
        logger.error(f"[ENG] fire error {name}: {e}")

def start(conn_factory):
    global _running, _conn_factory
    _conn_factory = conn_factory
    if _running:
        return
    _running = True

    # Event-driven thread (drains queue every second)
    def event_loop():
        from simulation import engine as sim
        while _running:
            try:
                events = sim.drain_events()
                if events:
                    rows  = _get_workflows()
                    state = sim.get_state()
                    for event in events:
                        for row in rows:
                            trigger    = json.loads(row["trigger_json"])
                            conditions = json.loads(row["conditions_json"])
                            if (_check_trigger(trigger, event) and
                                    _check_conditions(conditions, state)):
                                _fire(row)
            except Exception as e:
                logger.error(f"[ENG] event_loop: {e}")
            time.sleep(1)

    # Time-trigger thread (checks every 30s)
    def time_loop():
        while _running:
            try:
                rows = _get_workflows()
                for row in rows:
                    trigger = json.loads(row["trigger_json"])
                    if _check_time_trigger(trigger):
                        _fire(row)
            except Exception as e:
                logger.error(f"[ENG] time_loop: {e}")
            time.sleep(30)

    threading.Thread(target=event_loop, daemon=True).start()
    threading.Thread(target=time_loop,  daemon=True).start()
    logger.info("[ENG] Execution engine v2 started (event + time loops)")

def stop():
    global _running
    _running = False
