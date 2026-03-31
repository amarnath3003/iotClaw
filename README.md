# OpenClaw AI Automation Platform

An AI-assisted no-code automation platform for IoT and robotics workflows.

This repository combines:
- A FastAPI backend for chat, workflow storage, and simulation state
- A React frontend for chat-driven automation, workflow editing, and dashboard monitoring
- A simulation engine that mimics sensors/devices so workflows can be tested without hardware

## Project Idea

The core concept is:

Talk -> Workflow -> Execution

Users describe what they want in natural language. The AI assistant converts that into a structured workflow (trigger, conditions, actions). The backend stores and executes the workflow against simulated devices (and later real devices through adapters).

The product vision supports three experience levels:
- Consumer mode: plain-language automation chat
- Maker mode: visual workflow building/editing
- Power User mode: schema-focused JSON workflow output

## How It Works

### 1. Chat to Workflow
- Frontend sends conversation context and active mode to POST /chat
- Backend uses Gemini with mode-specific system prompts
- If the AI reply includes a workflow JSON block, frontend can save it as a workflow

### 2. Workflow Management
- Workflows are stored in SQLite (backend/openclaw.db)
- CRUD endpoints allow create, update, toggle, list, and delete
- Each update increments the workflow version
- Audit records are stored for key workflow events

### 3. Simulation and State
- A background simulation loop updates virtual sensors every 2 seconds
- Simulated device and sensor states are exposed via /state
- Dashboard polls:
  - /state (live state)
  - /execlog (execution history)
  - /notifications (user-facing alerts)

### 4. Execution Engine (Current Snapshot)
- Execution engine module exists with support for:
  - mqtt_event / time triggers
  - time / numeric / state conditions
  - device_control / delay / notify / robot_move actions
  - error policy with retries
- In the current backend startup path, execution start is wired through a backward-compatible entry point.
- The architecture is ready for a fuller event-bus-driven runtime integration.

## Current Features in This Repo

- Multi-mode chat UI (Consumer, Maker, Power User)
- AI-generated workflow detection and save flow
- Workflow list, edit, enable/disable, delete
- Real-time simulation dashboard with sensor/device states
- Backend workflow persistence and audit endpoint

## Tech Stack

- Backend: FastAPI, Pydantic, SQLite
- AI: Google Generative AI (Gemini)
- Frontend: React + Vite + Tailwind CSS
- Simulation: Python background simulation services

## Repository Layout

- backend/: FastAPI app, workflow/data logic, execution/simulation modules
- frontend/: React app (chat, workflow UI, dashboard)
- config/: shared settings module
- open_claw_ai_automation_platform_master_context.md: product architecture context
- open_claw_ai_automation_platform_v2.md: upgraded architecture and roadmap context

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Setup

From the backend folder:

```bash
pip install -r requirements.txt
```

Create backend/.env with:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

Run backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL:
- http://localhost:8000

### 2. Frontend Setup

From the frontend folder:

```bash
npm install
npm run dev
```

Frontend URL:
- http://localhost:5173

## Main API Endpoints

- GET /: service status
- POST /chat: AI assistant response (+ optional workflow JSON)
- GET /workflows: list workflows
- POST /workflows: create workflow
- GET /workflows/{id}: get one workflow
- PUT /workflows/{id}: update workflow
- PATCH /workflows/{id}/toggle: enable/disable workflow
- DELETE /workflows/{id}: delete workflow
- GET /state: simulation state snapshot
- POST /state/{device_path}: manual device control in simulation
- GET /execlog: execution log
- GET /notifications: simulation notifications
- GET /audit: workflow audit records

## Example Workflow Shape

```json
{
  "name": "Night Lighting",
  "description": "Turn on bedroom light when motion is detected at night",
  "enabled": true,
  "trigger": {
    "type": "mqtt_event",
    "topic": "sensor/motion",
    "condition": "payload == 'detected'"
  },
  "conditions": [
    {
      "type": "time",
      "after": "22:00",
      "before": "06:00"
    }
  ],
  "actions": [
    { "type": "device_control", "device": "light", "command": "on" },
    { "type": "delay", "seconds": 300 },
    { "type": "device_control", "device": "light", "command": "off" }
  ],
  "error_policy": {
    "retry_count": 2,
    "on_failure": "notify_user"
  }
}
```

## Roadmap Direction

Planned architecture in the context docs includes:
- API gateway + JWT auth
- MQTT-first event bus integration
- OpenClaw adapter for real skill execution
- Template library onboarding
- Stronger error handling and audit surfaces

## License

See LICENSE for project licensing details.