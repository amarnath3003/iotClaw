# OpenClaw v5 — Complete Setup & Run Guide

## What changed in v5

| Area | Before (v4) | After (v5) |
|------|-------------|------------|
| AI model | Anthropic Claude | Gemini 2.0 Flash |
| Device actions | Execution engine only | Gemini function calling (MCP tools) |
| Auth | None | JWT sessions (register / login) |
| Workflows | No ownership | Tied to your user account |
| OpenClaw adapter | Present | Removed |

---

## Project structure

```
openclaw/
├── .env                           ← Your keys (never commit this)
├── backend/
│   ├── main.py                    ← FastAPI server, all routes
│   ├── requirements.txt
│   ├── core/
│   │   ├── auth.py                ← JWT auth, user CRUD
│   │   ├── mcp_tools.py           ← IoT tools Gemini can call
│   │   └── execution_engine.py   ← Scheduled workflow runner
│   └── simulation/
│       └── engine.py              ← Virtual sensors + devices
└── frontend/
    └── src/
        ├── App.jsx                ← Root — auth gate + routing
        ├── api.js                 ← All backend calls (with auth header)
        └── components/
            ├── AuthScreens.jsx    ← Login + Register
            ├── Sidebar.jsx        ← Nav + user + sign out
            ├── Chat.jsx           ← Gemini agent chat
            ├── Dashboard.jsx      ← Live sensor/device view
            ├── WorkflowList.jsx   ← Saved automations
            ├── WorkflowEditor.jsx ← Visual builder
            └── TemplateLibrary.jsx← 15 ready-made automations
```

---

## Step 1 — Prerequisites

- Python 3.10+ — https://python.org/downloads
- Node.js 18+ — https://nodejs.org

---

## Step 2 — Get a Gemini API key

Go to https://aistudio.google.com/app/apikey and create a key.

---

## Step 3 — Install backend

```bash
cd openclaw/backend
python -m venv venv
venv\Scripts\activate        # Windows CMD
pip install -r requirements.txt
```

---

## Step 4 — Configure .env

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
SECRET_KEY=any-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

## Step 5 — Start backend

```bash
uvicorn main:app --reload --port 8000
```

Test: http://localhost:8000 should return `{"status":"OpenClaw v5 running"}`

---

## Step 6 — Start frontend

```bash
cd openclaw/frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Step 7 — Create account and start

Register with any username + email + password (min 6 chars). You're in.

---

## How Gemini function calling works

Say "turn on the fan and check the temperature":

1. Gemini decides to call `control_device("fan","on")` and `read_sensor("temperature")`
2. Backend executes those functions — updates simulation + real hardware if connected
3. Results returned to Gemini
4. Gemini replies with actual values: "Fan is on. Temperature is 27.3C."

The AI acts, not just talks.

---

## Three chat modes

| Mode | Gemini behavior |
|------|----------------|
| Consumer | Plain friendly language, no jargon |
| Maker | Explains logic, generates workflow JSON |
| Power User | Technical, shows tool calls + JSON |

---

## Troubleshooting

**ModuleNotFoundError** → venv not activated or pip install not run

**Gemini API 400 error** → Check GEMINI_API_KEY in .env

**Dashboard shows no data** → Backend crashed — check terminal

**"Session expired"** → SECRET_KEY changed — log out and back in

**npm errors** → Run npm install in frontend/

---

## API quick reference

| Method | Path | Auth | What it does |
|--------|------|------|-------------|
| POST | /auth/register | No | Create account |
| POST | /auth/login | No | Get JWT token |
| GET | /auth/me | Yes | Current user info |
| POST | /chat | Optional | Chat with Gemini |
| GET | /workflows | Optional | List workflows |
| POST | /workflows | Optional | Save workflow |
| PATCH | /workflows/{id}/toggle | No | Enable/disable |
| POST | /workflows/{id}/run | No | Run now |
| GET | /templates | No | 15 templates |
| POST | /templates/{id}/activate | Optional | Copy to workflows |
| GET | /state | No | Live sensor/device state |
| POST | /state/{device} | No | Control device |
| GET | /execlog | No | Execution history |
| GET | /notifications | No | Notifications |
