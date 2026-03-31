from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import google.generativeai as genai
from dotenv import load_dotenv
import os, uuid, json, sqlite3
from datetime import datetime
import sys
sys.path.insert(0, os.path.dirname(__file__))
from simulation import engine as sim
from core import execution_engine as exec_eng

# Load variables from backend/.env when present.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="OpenClaw Backend")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

# ── DB ────────────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "openclaw.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
            enabled INTEGER DEFAULT 1, version INTEGER DEFAULT 1,
            trigger_json TEXT DEFAULT '{"type":"manual"}',
            conditions_json TEXT DEFAULT '[]', actions_json TEXT DEFAULT '[]',
            error_policy_json TEXT DEFAULT '{"retry_count":2,"on_failure":"notify_user"}',
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT,
            event TEXT NOT NULL, detail TEXT DEFAULT '', ts TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit(); conn.close()

def row_to_wf(row):
    return {"id": row["id"], "name": row["name"], "description": row["description"],
            "enabled": bool(row["enabled"]), "version": row["version"],
            "trigger": json.loads(row["trigger_json"]),
            "conditions": json.loads(row["conditions_json"]),
            "actions": json.loads(row["actions_json"]),
            "error_policy": json.loads(row["error_policy_json"]),
            "created_at": row["created_at"], "updated_at": row["updated_at"]}

def audit(conn, wid, event, detail=""):
    conn.execute("INSERT INTO audit_log (workflow_id,event,detail) VALUES (?,?,?)", (wid, event, detail))

init_db()
sim.start()
exec_eng.start(get_conn)

# ── Models ────────────────────────────────────────────────────────────────────
SYSTEM_PROMPTS = {
    "consumer": """You are OpenClaw, a friendly AI assistant that helps people automate their home and IoT devices.
Keep responses simple, warm, and jargon-free. When the user describes something they want automated,
explain what you would do in plain everyday language. Use short sentences.
Never mention JSON, schemas, triggers, or technical terms.""",

    "maker": """You are OpenClaw, an AI assistant for building IoT and robotics automations.
When the user describes an automation, explain it clearly (trigger, conditions, actions).
If they described a complete automation, end your reply with a ```workflow JSON block:
{
  "name": "short name",
  "description": "one sentence",
  "trigger": {"type": "mqtt_event|time|manual", "topic": "sensor/motion", "condition": "payload == 'detected'"},
  "conditions": [{"type": "time", "after": "22:00", "before": "06:00"}],
  "actions": [
    {"type": "device_control", "device": "light", "command": "on"},
    {"type": "delay", "seconds": 300},
    {"type": "device_control", "device": "light", "command": "off"}
  ],
  "error_policy": {"retry_count": 2, "on_failure": "notify_user"}
}
Available devices: light, fan, pump, camera, robot
Available sensors (MQTT topics): sensor/motion, sensor/temperature, sensor/moisture, sensor/door, sensor/light_level
Only output ```workflow if the automation is complete.""",

    "poweruser": """You are OpenClaw, an AI assistant for advanced IoT automation.
Always respond with explanation + a ```workflow JSON block using this schema:
{"name":"string","description":"string","trigger":{"type":"mqtt_event|time|manual","topic":"string","condition":"string"},
"conditions":[{"type":"time|numeric|state",...}],"actions":[{"type":"device_control|delay|notify|robot_move",...}],
"error_policy":{"retry_count":2,"on_failure":"notify_user"}}
Available sensors: sensor/motion, sensor/temperature, sensor/moisture, sensor/door, sensor/light_level
Available devices: device/light, device/fan, device/pump, device/camera, device/robot"""
}

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

# ── Chat ──────────────────────────────────────────────────────────────────────
@app.get("/")
def root(): return {"status": "OpenClaw running", "sim": "active"}

@app.post("/chat")
def chat(req: ChatRequest):
    if req.mode not in SYSTEM_PROMPTS:
        raise HTTPException(400, "Invalid mode")
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(500, "GEMINI_API_KEY is not configured")

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPTS[req.mode],
    )

    contents = []
    for m in req.messages:
        role = "model" if m.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m.content}]})

    resp = model.generate_content(contents)
    reply = resp.text or ""
    workflow = None
    if "```workflow" in reply:
        try:
            raw = reply.split("```workflow")[1].split("```")[0].strip()
            workflow = json.loads(raw)
        except Exception:
            pass
    return {"reply": reply, "workflow": workflow}

# ── Workflow CRUD ─────────────────────────────────────────────────────────────
@app.get("/workflows")
def list_workflows():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM workflows ORDER BY updated_at DESC").fetchall()
    conn.close()
    return [row_to_wf(r) for r in rows]

@app.post("/workflows")
def create_workflow(body: WorkflowSave):
    wid = str(uuid.uuid4())
    conn = get_conn()
    conn.execute("INSERT INTO workflows (id,name,description,enabled,trigger_json,conditions_json,actions_json,error_policy_json) VALUES (?,?,?,?,?,?,?,?)",
        (wid, body.name, body.description, int(body.enabled),
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
    row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Not found")
    return row_to_wf(row)

@app.put("/workflows/{wid}")
def update_workflow(wid: str, body: WorkflowSave):
    conn = get_conn()
    ex = conn.execute("SELECT version FROM workflows WHERE id=?", (wid,)).fetchone()
    if not ex: conn.close(); raise HTTPException(404, "Not found")
    v = ex["version"] + 1
    conn.execute("UPDATE workflows SET name=?,description=?,enabled=?,version=?,trigger_json=?,conditions_json=?,actions_json=?,error_policy_json=?,updated_at=datetime('now') WHERE id=?",
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
    row = conn.execute("SELECT enabled FROM workflows WHERE id=?", (wid,)).fetchone()
    if not row: conn.close(); raise HTTPException(404, "Not found")
    new = 0 if row["enabled"] else 1
    conn.execute("UPDATE workflows SET enabled=?,updated_at=datetime('now') WHERE id=?", (new, wid))
    audit(conn, wid, "toggled", "on" if new else "off")
    conn.commit(); conn.close()
    return {"enabled": bool(new)}

# ── Simulation / State endpoints ──────────────────────────────────────────────
@app.get("/state")
def get_state(): return sim.get_state()

@app.post("/state/{device_path:path}")
def control_device(device_path: str, body: DeviceControl):
    topic = device_path if "/" in device_path else f"device/{device_path}"
    ok = sim.set_device(topic, body.value)
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