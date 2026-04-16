"""
OpenClaw Backend v5
- Gemini 2.0 Flash with function calling (MCP tools)
- JWT auth (register / login / me)
- Workflow CRUD + execution engine
- Simulation engine (live sensors/devices)
- Template library (15 templates)
"""

import logging, os, json, uuid, sqlite3, sys, threading
from datetime import datetime
from typing import List, Optional, Any

from dotenv import load_dotenv
load_dotenv()

from google import genai
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from core.device_registry import (init_device_tables, get_devices_for_user,
                                    get_device, create_device, update_device,
                                    delete_device, get_rooms, create_room,
                                    build_ai_device_context,
                                    get_exec_log_persistent)
from core import mqtt_bridge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set AUTH_ENABLED=true to restore JWT login/register/me flows.
AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")

# ── WebSocket connection manager ──────────────────────────────────────────────
class WSManager:
    def __init__(self):
        self._conns: list = []
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._conns.append(ws)
    def disconnect(self, ws: WebSocket):
        if ws in self._conns:
            self._conns.remove(ws)
    async def broadcast(self, data: dict):
        import asyncio
        dead = []
        for ws in list(self._conns):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

ws_manager = WSManager()

# ── Simple in-memory rate limiter for auth endpoints ─────────────────────────
import collections, time as _time
_auth_hits: dict = collections.defaultdict(list)
AUTH_LIMIT = 10   # max attempts
AUTH_WINDOW = 60  # seconds

def _check_rate_limit(key: str):
    now = _time.time()
    hits = [t for t in _auth_hits[key] if now - t < AUTH_WINDOW]
    _auth_hits[key] = hits
    if len(hits) >= AUTH_LIMIT:
        raise HTTPException(429, "Too many attempts — wait 60 seconds")
    _auth_hits[key].append(now)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="OpenClaw", version="5.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

import asyncio as _asyncio
_event_loop: _asyncio.AbstractEventLoop = None

@app.on_event("startup")
async def _capture_event_loop():
    global _event_loop
    _event_loop = _asyncio.get_running_loop()

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

# ── DB ────────────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "openclaw.db")

def get_conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1, version INTEGER DEFAULT 1,
            user_id TEXT DEFAULT '',
            trigger_json      TEXT DEFAULT '{"type":"manual"}',
            conditions_json   TEXT DEFAULT '[]',
            actions_json      TEXT DEFAULT '[]',
            error_policy_json TEXT DEFAULT '{"retry_count":2,"on_failure":"notify_user"}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id TEXT, event TEXT NOT NULL,
            detail TEXT DEFAULT '', ts TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            username   TEXT UNIQUE NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            hashed_pw  TEXT NOT NULL,
            role       TEXT DEFAULT 'user',
            onboarding_done  INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    # Safe migration: add column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass  # column already exists
    conn.commit(); conn.close()

def row_to_wf(row):
    return {
        "id": row["id"], "name": row["name"], "description": row["description"],
        "enabled": bool(row["enabled"]), "version": row["version"],
        "user_id": row["user_id"] if "user_id" in row.keys() else "",
        "trigger":      json.loads(row["trigger_json"]),
        "conditions":   json.loads(row["conditions_json"]),
        "actions":      json.loads(row["actions_json"]),
        "error_policy": json.loads(row["error_policy_json"]),
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }

def audit(conn, wid, event, detail=""):
    conn.execute("INSERT INTO audit_log (workflow_id,event,detail) VALUES (?,?,?)",
                 (wid, event, detail))

init_db()

# ── Auth init ─────────────────────────────────────────────────────────────────
from core.auth import (init_auth_tables, create_user, get_user_by_username,
                        verify_password, create_token, get_current_user,
                        get_current_user_optional)
init_auth_tables()
init_device_tables()

# ── Simulation + execution engines ───────────────────────────────────────────
from simulation import engine as sim
from core.execution_engine import start as start_exec
from core.mcp_tools import TOOL_FUNCTIONS, GEMINI_TOOLS

sim.start()
start_exec(get_conn)
mqtt_bridge.start()

# ── Gemini setup ──────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

SYSTEM_BASE = """You are OpenClaw, an AI assistant for smart home and IoT automation.
You control real devices and sensors via MQTT.

{device_context}

Always confirm what you did after acting. Be helpful and proactive.
For recurring automations, suggest saving as a workflow.
If no devices are registered, tell the user to add them in the Devices view.
"""

MODE_HINTS = {
    "consumer":  "Reply warmly in plain everyday language. No technical terms or jargon. Keep it short and friendly.",
    "maker":     "Explain the automation logic (trigger → conditions → actions). Be informative but not overly technical. If the user describes a full automation, also append a ```workflow JSON block.",
    "poweruser": "Be precise and technical. Include tool names and parameters used. Append a ```workflow JSON block for any described automation.",
}

WORKFLOW_SCHEMA_HINT = """
If appending a ```workflow block, use this schema:
{"name":"string","description":"string",
"trigger":{"type":"mqtt_event|time|manual","topic":"sensor/motion","condition":"payload == 'detected'"},
"conditions":[{"type":"time","after":"22:00","before":"06:00"}],
"actions":[{"type":"device_control","device":"light","command":"on"},{"type":"delay","seconds":300}],
"error_policy":{"retry_count":2,"on_failure":"notify_user"}}"""

# ── Pydantic models ───────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str; content: str

class ChatRequest(BaseModel):
    messages: List[Message]; mode: str = "consumer"

class WorkflowSave(BaseModel):
    name: str; description: Optional[str] = ""
    enabled: Optional[bool] = True
    trigger: Optional[dict] = {"type": "manual"}
    conditions: Optional[List[Any]] = []
    actions: Optional[List[Any]] = []
    error_policy: Optional[dict] = {"retry_count": 2, "on_failure": "notify_user"}

class DeviceControl(BaseModel):
    value: Any

class RegisterRequest(BaseModel):
    username: str; email: str; password: str

class DeviceSave(BaseModel):
    name:           str
    device_type:    str
    room:           Optional[str] = ""
    icon:           Optional[str] = "◎"
    is_sensor:      Optional[bool] = False
    mqtt_topic_get: Optional[str] = ""
    mqtt_topic_set: Optional[str] = ""
    unit:           Optional[str] = ""
    notes:          Optional[str] = ""

class RoomSave(BaseModel):
    name: str
    icon: Optional[str] = "◎"

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "OpenClaw v5 running", "model": GEMINI_MODEL}

# ── Auth endpoints ────────────────────────────────────────────────────────────
@app.post("/auth/register")
def register(body: RegisterRequest):
    if not AUTH_ENABLED:
        raise HTTPException(503, "Authentication is currently disabled")
    _check_rate_limit(f"register:{body.username}")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        user  = create_user(body.username, body.email, body.password)
        token = create_token(user["id"], user["username"], user["role"])
        return {"access_token": token, "token_type": "bearer", "user": user}
    except ValueError as e:
        raise HTTPException(400, str(e))

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    if not AUTH_ENABLED:
        raise HTTPException(503, "Authentication is currently disabled")
    _check_rate_limit(f"login:{form.username}")
    user = get_user_by_username(form.username)
    if not user:
        raise HTTPException(401, "Invalid username or password")
    from core.auth import get_user_by_id
    conn = get_conn()
    row  = conn.execute("SELECT hashed_pw FROM users WHERE id=?", (user["id"],)).fetchone()
    conn.close()
    if not row or not verify_password(form.password, row["hashed_pw"]):
        raise HTTPException(401, "Invalid username or password")
    token = create_token(user["id"], user["username"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    if not AUTH_ENABLED:
        raise HTTPException(503, "Authentication is currently disabled")
    conn = get_conn()
    row  = conn.execute("SELECT onboarding_done FROM users WHERE id=?",
                        (current_user["id"],)).fetchone()
    conn.close()
    current_user["onboarding_done"] = bool(row["onboarding_done"]) if row else False
    return current_user

# ── Chat with Gemini + function calling ───────────────────────────────────────
@app.post("/chat")
def chat(req: ChatRequest, current_user: Optional[dict] = Depends(get_current_user_optional)):
    mode = req.mode if req.mode in MODE_HINTS else "consumer"
    uid  = current_user["id"] if current_user else ""

    device_ctx = build_ai_device_context(uid)
    system = SYSTEM_BASE.format(device_context=device_ctx)
    system += f"\n\nMode: {MODE_HINTS[mode]}"
    if mode in ("maker", "poweruser"):
        system += WORKFLOW_SCHEMA_HINT

    # Build Gemini content history in google.genai format.
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    contents = []
    for m in messages:
        contents.append({
            "role": "user" if m["role"] == "user" else "model",
            "parts": [{"text": m["content"]}],
        })

    if not genai_client:
        raise HTTPException(500, "Missing GEMINI_API_KEY")

    def _extract_function_calls(resp) -> list:
        # google.genai exposes function calls either directly or via candidate parts.
        direct = getattr(resp, "function_calls", None)
        if direct:
            return list(direct)
        calls = []
        candidates = getattr(resp, "candidates", []) or []
        for cand in candidates:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", []) if content else []
            for p in parts:
                fc = getattr(p, "function_call", None)
                if fc and getattr(fc, "name", None):
                    calls.append(fc)
        return calls

    try:
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config={
                "system_instruction": system,
                "tools": GEMINI_TOOLS,
            },
        )

        # Agentic loop — track all tool calls for frontend visibility
        all_tool_calls = []
        max_rounds = 5
        for _ in range(max_rounds):
            function_calls = _extract_function_calls(response)
            if not function_calls:
                break

            tool_parts = []
            for fc in function_calls:
                fn_name = getattr(fc, "name", None)
                raw_args = getattr(fc, "args", None) or {}
                args = dict(raw_args) if hasattr(raw_args, "items") else {}
                fn = TOOL_FUNCTIONS.get(fn_name)
                try:
                    result = fn(**args) if fn else {"error": f"Unknown tool: {fn_name}"}
                    ok = "error" not in result
                except Exception as e:
                    result = {"error": str(e)}
                    ok = False
                    logger.error(f"[CHAT] Tool {fn_name} error: {e}")

                all_tool_calls.append({"name": fn_name, "args": args, "ok": ok})
                tool_parts.append({
                    "function_response": {
                        "name": fn_name,
                        "response": {"result": json.dumps(result)},
                    }
                })

            contents.append({"role": "tool", "parts": tool_parts})
            response = genai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config={
                    "system_instruction": system,
                    "tools": GEMINI_TOOLS,
                },
            )

        reply = response.text if hasattr(response, "text") else ""

        # Extract embedded workflow JSON if present
        workflow = None
        if "```workflow" in reply:
            try:
                raw      = reply.split("```workflow")[1].split("```")[0].strip()
                workflow = json.loads(raw)
            except Exception:
                pass

        return {"reply": reply, "workflow": workflow, "tool_calls": all_tool_calls}

    except Exception as e:
        logger.error(f"[CHAT] Gemini error: {e}")
        raise HTTPException(500, f"AI error: {str(e)}")

# ── Workflow CRUD ─────────────────────────────────────────────────────────────
@app.get("/workflows")
def list_workflows(current_user: Optional[dict] = Depends(get_current_user_optional)):
    conn = get_conn()
    if current_user:
        rows = conn.execute(
            "SELECT * FROM workflows WHERE user_id=? OR user_id='' ORDER BY updated_at DESC",
            (current_user["id"],)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM workflows ORDER BY updated_at DESC").fetchall()
    conn.close()
    return [row_to_wf(r) for r in rows]

@app.post("/workflows")
def create_workflow(body: WorkflowSave,
                    current_user: Optional[dict] = Depends(get_current_user_optional)):
    wid = str(uuid.uuid4())
    uid = current_user["id"] if current_user else ""
    conn = get_conn()
    conn.execute("""INSERT INTO workflows
        (id,name,description,enabled,user_id,trigger_json,conditions_json,actions_json,error_policy_json)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (wid, body.name, body.description, int(body.enabled), uid,
         json.dumps(body.trigger), json.dumps(body.conditions),
         json.dumps(body.actions), json.dumps(body.error_policy)))
    audit(conn, wid, "created", body.name)
    conn.commit()
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    return row_to_wf(row)

@app.get("/workflows/{wid}")
def get_workflow(wid: str):
    conn = get_conn()
    row  = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Not found")
    return row_to_wf(row)

@app.put("/workflows/{wid}")
def update_workflow(wid: str, body: WorkflowSave):
    conn = get_conn()
    ex   = conn.execute("SELECT version FROM workflows WHERE id=?", (wid,)).fetchone()
    if not ex: conn.close(); raise HTTPException(404, "Not found")
    v = ex["version"] + 1
    conn.execute("""UPDATE workflows SET name=?,description=?,enabled=?,version=?,
        trigger_json=?,conditions_json=?,actions_json=?,error_policy_json=?,
        updated_at=datetime('now') WHERE id=?""",
        (body.name, body.description, int(body.enabled), v,
         json.dumps(body.trigger), json.dumps(body.conditions),
         json.dumps(body.actions), json.dumps(body.error_policy), wid))
    audit(conn, wid, "updated", f"v{v}")
    conn.commit()
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    return row_to_wf(row)

@app.delete("/workflows/{wid}")
def delete_workflow(wid: str):
    conn = get_conn()
    conn.execute("DELETE FROM workflows WHERE id=?", (wid,))
    audit(conn, wid, "deleted", "")
    conn.commit(); conn.close()
    return {"ok": True}

@app.patch("/workflows/{wid}/toggle")
def toggle_workflow(wid: str):
    conn = get_conn()
    row  = conn.execute("SELECT enabled FROM workflows WHERE id=?", (wid,)).fetchone()
    if not row: conn.close(); raise HTTPException(404, "Not found")
    new  = 0 if row["enabled"] else 1
    conn.execute("UPDATE workflows SET enabled=?,updated_at=datetime('now') WHERE id=?", (new, wid))
    audit(conn, wid, "toggled", "on" if new else "off")
    conn.commit(); conn.close()
    return {"enabled": bool(new)}

@app.post("/workflows/{wid}/run")
def run_workflow_now(wid: str):
    conn = get_conn()
    row  = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Not found")
    wf = row_to_wf(row)
    def _run():
        from core.execution_engine import _execute_actions
        _execute_actions(wf["actions"], wf["name"])
    threading.Thread(target=_run, daemon=True).start()
    return {"status": "triggered", "workflow": wf["name"]}

# ── State / devices ───────────────────────────────────────────────────────────
@app.get("/state")
def get_state(): return sim.get_state()

@app.post("/state/{path:path}")
def control_device(path: str, body: DeviceControl):
    topic = path if "/" in path else f"device/{path}"
    ok    = sim.set_device(topic, body.value)
    if not ok: raise HTTPException(404, f"Device {topic} not found")
    sim.push_exec_log("manual", f"{topic} → {body.value}", "ok")
    return {"ok": True, "topic": topic, "value": body.value}

@app.get("/execlog")
def get_execlog(): return sim.get_exec_log()

@app.get("/notifications")
def get_notifications(): return sim.get_notifications()

@app.get("/audit")
def get_audit(limit: int = 50):
    conn = get_conn()
    rows = conn.execute("SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── System status ─────────────────────────────────────────────────────────────
@app.get("/status")
def system_status():
    return {
        "version":        "6.0",
        "sim_mode":       sim.get_simulation_mode(),
        "mqtt_connected": mqtt_bridge.is_connected(),
        "mqtt_host":      os.environ.get("MQTT_HOST", ""),
        "model":          GEMINI_MODEL,
        "device_count":   len(get_devices_for_user()),
    }


# ── Device registry ───────────────────────────────────────────────────────────
@app.get("/devices")
def list_devices(current_user: Optional[dict] = Depends(get_current_user_optional)):
    uid = current_user["id"] if current_user else ""
    return get_devices_for_user(uid)

@app.post("/devices")
def add_device(body: DeviceSave,
               current_user: Optional[dict] = Depends(get_current_user_optional)):
    uid = current_user["id"] if current_user else ""
    return create_device(body.model_dump(), uid)

@app.put("/devices/{did}")
def edit_device(did: str, body: DeviceSave):
    result = update_device(did, body.model_dump())
    if not result: raise HTTPException(404, "Device not found")
    return result

@app.delete("/devices/{did}")
def remove_device(did: str):
    delete_device(did)
    return {"ok": True}

@app.post("/devices/{did}/test")
def test_device(did: str, body: dict):
    """Send a test MQTT command to a real device."""
    device = get_device(did)
    if not device: raise HTTPException(404, "Device not found")
    topic   = device.get("mqtt_topic_set", "")
    payload = body.get("payload", "ON")
    if not topic: raise HTTPException(400, "Device has no MQTT set-topic configured")
    sent = mqtt_bridge.publish(topic, payload)
    return {"ok": sent, "topic": topic, "payload": payload,
            "via": "hardware" if sent else "mqtt_not_connected"}


# ── Rooms ─────────────────────────────────────────────────────────────────────
@app.get("/rooms")
def list_rooms(current_user: Optional[dict] = Depends(get_current_user_optional)):
    uid = current_user["id"] if current_user else ""
    return get_rooms(uid)

@app.post("/rooms")
def add_room(body: RoomSave,
             current_user: Optional[dict] = Depends(get_current_user_optional)):
    uid = current_user["id"] if current_user else ""
    return create_room(body.name, body.icon, uid)


# ── Persistent exec log ───────────────────────────────────────────────────────
@app.get("/execlog/history")
def get_execlog_history(limit: int = 100):
    """Persistent execution log — survives server restarts."""
    return get_exec_log_persistent(limit)


# ── Onboarding ────────────────────────────────────────────────────────────────
@app.post("/auth/onboarding-done")
def complete_onboarding(current_user: dict = Depends(get_current_user)):
    conn = get_conn()
    conn.execute("UPDATE users SET onboarding_done=1 WHERE id=?",
                 (current_user["id"],))
    conn.commit(); conn.close()
    return {"ok": True}


# ── WebSocket — real-time state push ─────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep alive / ping
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@app.get("/ws/state")
async def push_state():
    """Push current state to all WebSocket clients (called by sim tick)."""
    await ws_manager.broadcast({"type": "state", "data": sim.get_state(), "sim_mode": sim.get_simulation_mode()})
    return {"ok": True}

# ── Templates ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {"id":"t1","name":"Night lighting","category":"Home","description":"Motion after 10PM turns light on for 5 min","icon":"◎",
     "trigger":{"type":"mqtt_event","topic":"sensor/motion","condition":"payload == 'detected'"},
     "conditions":[{"type":"time","after":"22:00","before":"06:00"}],
     "actions":[{"type":"device_control","device":"light","command":"on"},{"type":"delay","seconds":300},{"type":"device_control","device":"light","command":"off"}],
     "error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t2","name":"Temperature alert","category":"Climate","description":"Fan on + notify when temp exceeds 30°C","icon":"◷",
     "trigger":{"type":"mqtt_event","topic":"sensor/temperature","condition":"float(payload) > 30"},
     "conditions":[],"actions":[{"type":"device_control","device":"fan","command":"on"},{"type":"notify","message":"Temperature exceeded 30°C!"}],
     "error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t3","name":"Smart irrigation","category":"Garden","description":"Pump on in morning when soil is dry","icon":"⬡",
     "trigger":{"type":"mqtt_event","topic":"sensor/moisture","condition":"float(payload) < 30"},
     "conditions":[{"type":"time","after":"06:00","before":"09:00"}],
     "actions":[{"type":"device_control","device":"pump","command":"on"},{"type":"delay","seconds":600},{"type":"device_control","device":"pump","command":"off"}],
     "error_policy":{"retry_count":1,"on_failure":"notify_user"}},
    {"id":"t4","name":"Security mode","category":"Security","description":"Motion at night triggers camera + alert","icon":"◩",
     "trigger":{"type":"mqtt_event","topic":"sensor/motion","condition":"payload == 'detected'"},
     "conditions":[{"type":"time","after":"23:00","before":"05:00"}],
     "actions":[{"type":"device_control","device":"camera","command":"on"},{"type":"device_control","device":"light","command":"on"},{"type":"notify","message":"Motion detected at night!"}],
     "error_policy":{"retry_count":3,"on_failure":"notify_user"}},
    {"id":"t5","name":"Welcome home","category":"Home","description":"Door open → lights + fan on","icon":"◎",
     "trigger":{"type":"mqtt_event","topic":"sensor/door","condition":"payload == 'open'"},
     "conditions":[],"actions":[{"type":"device_control","device":"light","command":"on"},{"type":"device_control","device":"fan","command":"on"}],
     "error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t6","name":"Bedtime mode","category":"Home","description":"All devices off at 11PM","icon":"◷",
     "trigger":{"type":"time","cron":"0 23 * * *"},"conditions":[],
     "actions":[{"type":"device_control","device":"light","command":"off"},{"type":"device_control","device":"fan","command":"off"},{"type":"device_control","device":"camera","command":"off"}],
     "error_policy":{"retry_count":1,"on_failure":"ignore"}},
    {"id":"t7","name":"Morning cool-down","category":"Climate","description":"Fan on in morning if warm","icon":"◷",
     "trigger":{"type":"mqtt_event","topic":"sensor/temperature","condition":"float(payload) > 26"},
     "conditions":[{"type":"time","after":"07:00","before":"10:00"}],
     "actions":[{"type":"device_control","device":"fan","command":"on"},{"type":"notify","message":"Morning cool-down activated"}],
     "error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t8","name":"Overheat protection","category":"Climate","description":"Fan max + alert when critical","icon":"◷",
     "trigger":{"type":"mqtt_event","topic":"sensor/temperature","condition":"float(payload) > 38"},
     "conditions":[],"actions":[{"type":"device_control","device":"fan","command":"on"},{"type":"notify","message":"CRITICAL: Temperature above 38°C!"}],
     "error_policy":{"retry_count":3,"on_failure":"notify_user"}},
    {"id":"t9","name":"Energy saver","category":"Home","description":"Lights + fan off every 30 min","icon":"◷",
     "trigger":{"type":"time","cron":"*/30 * * * *"},"conditions":[],
     "actions":[{"type":"device_control","device":"light","command":"off"},{"type":"device_control","device":"fan","command":"off"}],
     "error_policy":{"retry_count":1,"on_failure":"ignore"}},
    {"id":"t10","name":"Plant care alert","category":"Garden","description":"Notify when soil moisture critical","icon":"⬡",
     "trigger":{"type":"mqtt_event","topic":"sensor/moisture","condition":"float(payload) < 20"},
     "conditions":[],"actions":[{"type":"notify","message":"Plants need water! Soil moisture critical."}],
     "error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t11","name":"Good morning","category":"Home","description":"Lights on at 7AM","icon":"◷",
     "trigger":{"type":"time","cron":"0 7 * * *"},"conditions":[],
     "actions":[{"type":"device_control","device":"light","command":"on"},{"type":"notify","message":"Good morning!"}],
     "error_policy":{"retry_count":1,"on_failure":"ignore"}},
    {"id":"t12","name":"Robot patrol","category":"Robotics","description":"Robot patrols every 6 hours","icon":"⬡",
     "trigger":{"type":"time","cron":"0 */6 * * *"},"conditions":[],
     "actions":[{"type":"robot_move","command":"forward"},{"type":"delay","seconds":5},{"type":"robot_move","command":"turn_right"},{"type":"delay","seconds":3},{"type":"robot_move","command":"stop"}],
     "error_policy":{"retry_count":1,"on_failure":"notify_user"}},
    {"id":"t13","name":"Door alert","category":"Security","description":"Notify when door opens","icon":"◩",
     "trigger":{"type":"mqtt_event","topic":"sensor/door","condition":"payload == 'open'"},"conditions":[],
     "actions":[{"type":"notify","message":"Door opened!"}],"error_policy":{"retry_count":1,"on_failure":"ignore"}},
    {"id":"t14","name":"Auto lights","category":"Home","description":"Turn on light when it gets dark","icon":"◎",
     "trigger":{"type":"mqtt_event","topic":"sensor/light_level","condition":"float(payload) < 50"},"conditions":[],
     "actions":[{"type":"device_control","device":"light","command":"on"}],"error_policy":{"retry_count":2,"on_failure":"notify_user"}},
    {"id":"t15","name":"Full security lockdown","category":"Security","description":"Camera + lights + alert on night motion","icon":"◩",
     "trigger":{"type":"mqtt_event","topic":"sensor/motion","condition":"payload == 'detected'"},
     "conditions":[{"type":"time","after":"22:00","before":"06:00"}],
     "actions":[{"type":"device_control","device":"camera","command":"on"},{"type":"device_control","device":"light","command":"on"},{"type":"notify","message":"Security alert: motion detected!"},{"type":"delay","seconds":30},{"type":"device_control","device":"light","command":"off"}],
     "error_policy":{"retry_count":3,"on_failure":"notify_user"}},
]

@app.get("/templates")
def list_templates(category: Optional[str] = None):
    if category:
        return [t for t in TEMPLATES if t["category"].lower() == category.lower()]
    return TEMPLATES

@app.post("/templates/{tid}/activate")
def activate_template(tid: str,
                       current_user: Optional[dict] = Depends(get_current_user_optional)):
    tmpl = next((t for t in TEMPLATES if t["id"] == tid), None)
    if not tmpl: raise HTTPException(404, "Template not found")
    wid  = str(uuid.uuid4())
    uid  = current_user["id"] if current_user else ""
    conn = get_conn()
    conn.execute("""INSERT INTO workflows
        (id,name,description,enabled,user_id,trigger_json,conditions_json,actions_json,error_policy_json)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (wid, tmpl["name"], tmpl["description"], 1, uid,
         json.dumps(tmpl["trigger"]), json.dumps(tmpl["conditions"]),
         json.dumps(tmpl["actions"]), json.dumps(tmpl["error_policy"])))
    audit(conn, wid, "created_from_template", tmpl["name"])
    conn.commit()
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    return row_to_wf(row)

# ── Workflow export / import ──────────────────────────────────────────────────
@app.get("/workflows/{wid}/export")
def export_workflow(wid: str):
    conn = get_conn()
    row  = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Not found")
    wf = row_to_wf(row)
    # Strip runtime fields for clean export
    for k in ("id", "user_id", "created_at", "updated_at", "version"):
        wf.pop(k, None)
    return wf

@app.post("/workflows/import")
def import_workflow(body: dict,
                    current_user: Optional[dict] = Depends(get_current_user_optional)):
    """Accept a workflow JSON (exported or hand-crafted) and save it."""
    name = body.get("name", "Imported workflow")
    wid  = str(uuid.uuid4())
    uid  = current_user["id"] if current_user else ""
    conn = get_conn()
    conn.execute("""INSERT INTO workflows
        (id,name,description,enabled,user_id,trigger_json,conditions_json,actions_json,error_policy_json)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (wid, name, body.get("description", ""), 1, uid,
         json.dumps(body.get("trigger", {"type": "manual"})),
         json.dumps(body.get("conditions", [])),
         json.dumps(body.get("actions", [])),
         json.dumps(body.get("error_policy", {"retry_count": 2, "on_failure": "notify_user"}))))
    audit(conn, wid, "imported", name)
    conn.commit()
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    return row_to_wf(row)

# ── Settings / user preferences ───────────────────────────────────────────────
@app.get("/settings")
def get_settings(current_user: Optional[dict] = Depends(get_current_user_optional)):
    return {
        "user":       current_user or {"id": "guest", "username": "Guest", "email": "guest@local", "role": "guest"},
        "model":      GEMINI_MODEL,
        "sim_active": True,
        "version":    "5.0",
    }

@app.put("/settings/password")
def change_password(body: dict, current_user: dict = Depends(get_current_user)):
    if not AUTH_ENABLED:
        raise HTTPException(503, "Authentication is currently disabled")
    old_pw  = body.get("old_password", "")
    new_pw  = body.get("new_password", "")
    if len(new_pw) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    conn = get_conn()
    row  = conn.execute("SELECT hashed_pw FROM users WHERE id=?", (current_user["id"],)).fetchone()
    conn.close()
    if not row or not verify_password(old_pw, row["hashed_pw"]):
        raise HTTPException(401, "Current password is incorrect")
    from core.auth import hash_password
    new_hash = hash_password(new_pw)
    conn = get_conn()
    conn.execute("UPDATE users SET hashed_pw=? WHERE id=?", (new_hash, current_user["id"]))
    conn.commit(); conn.close()
    return {"ok": True}
