# 🧠 OpenClaw AI Automation Platform (Master Context v2)

> Upgraded plan — incorporates multi-audience design, API gateway, error handling, audit logging, MQTT decision lock-in, and workflow template library.

---

## 📌 Project Overview

This project is an **AI-powered automation platform** built on top of OpenClaw, designed for **everyone** — from general consumers to developers and makers.

- OpenClaw acts as the **execution engine**
- This platform acts as the **user interface + orchestration layer**
- The AI layer acts as the **translator between intent and automation**

### 🎯 Goal

To enable users to:
- Create IoT and robotics automations using **natural language chat**
- Edit and visualize workflows using a **drag-and-drop builder**
- Execute automations via **OpenClaw skills**
- Simulate and control devices (with or without hardware)
- Get started instantly using **pre-built workflow templates**

---

## 🧠 Core Concept

> "Talk → Workflow → Execution"

User describes automation → AI converts to structured workflow → System executes via OpenClaw.

The platform adapts to the user's technical level — a consumer never sees a workflow schema, while a developer gets full JSON access.

---

## 👥 User Mode Layer (NEW)

This is the most critical addition for reaching a general consumer audience. The UI and experience adapts based on who is using it.

### Three Modes

#### Consumer Mode
- Chat-only interface
- No workflow schema exposed
- Uses template library for quick starts
- Actions described in plain English ("turn on the fan when it gets hot")
- Errors shown as friendly messages ("Your fan automation stopped — tap to fix")

#### Maker Mode
- Can view and edit the generated workflow visually
- Drag-and-drop builder accessible
- Understands concepts like triggers, conditions, and actions
- Can inspect but not directly edit JSON

#### Power User Mode
- Full JSON workflow access
- Direct schema editing
- Advanced condition logic
- API access for external integrations

### Mode Switching
- Default mode is Consumer
- Users can opt into Maker or Power User mode from settings
- The AI layer always works the same underneath — only the presentation layer changes

---

## 🏗️ System Architecture

### 1. Frontend Layer

Components:
- Chat Interface (AI-first, adapts to user mode)
- Visual Workflow Builder (Maker + Power User only)
- Dashboard (device + system state, simplified for Consumer)
- Event Timeline (logs — plain language for Consumer, detailed for others)
- Template Browser (Consumer-first onboarding)

Key Principles:
- Frontend **never** directly communicates with OpenClaw
- Always goes through the backend via the API gateway
- UI components render conditionally based on active user mode

---

### 2. API Gateway + Auth (NEW)

Sits between the frontend and the backend. Every request passes through here.

Responsibilities:
- JWT-based session authentication
- Rate limiting per user/session
- Input validation and sanitization
- Route requests to correct backend modules
- Block malformed or oversized payloads

Implementation: FastAPI middleware + `python-jose` for JWT

```python
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # validate JWT, return user
    pass
```

---

### 3. AI Layer

Responsibilities:
- Convert natural language → workflow JSON
- Suggest workflow improvements
- Interpret vague or incomplete user instructions
- Power the Consumer mode chat experience

Important Rules:
- AI does **not** execute actions
- AI only generates or modifies workflow JSON
- AI responses are validated against the workflow schema before being saved

#### Prompt Design Principle

The AI system prompt should include the full workflow schema and a set of few-shot examples. Consumer mode prompts should nudge the model toward simpler, template-compatible workflows.

---

### 4. Backend (Core System)

#### a. Workflow Manager
- Store and retrieve workflows
- Full CRUD operations
- Versioning (every save creates a new version)
- Enable / disable workflows
- Duplicate and rename
- Associate workflows with user accounts

#### b. Execution Engine
- Runs workflows triggered by events
- Supports:
  - Event triggers (sensor, time, manual)
  - Conditions (time-based, numeric, state-based)
  - Multiple sequential and parallel actions
  - Delays between actions
  - Mode/state-based logic
  - Robotics-specific actions
  - Notifications

#### c. Event Bus — **MQTT (locked in)**

> Decision: MQTT is the event bus. Redis Pub/Sub is **not** used for the primary event system.

Reasons:
- MQTT is purpose-built for IoT device communication
- Native support on ESP32 and Raspberry Pi
- The simulation engine can mock a local MQTT broker (use `mosquitto` locally)
- Scales to real hardware without changing the architecture

```python
import paho.mqtt.client as mqtt

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    event_bus.dispatch(topic, payload)

client = mqtt.Client()
client.on_message = on_message
client.connect("localhost", 1883)
client.subscribe("#")
client.loop_start()
```

#### d. OpenClaw Adapter
- Bridge between the backend and OpenClaw
- Translates workflow action objects into OpenClaw skill calls
- Returns execution results back to the execution engine

```python
class OpenClawAdapter:
    def run_action(self, action: dict) -> dict:
        skill = self._resolve_skill(action["type"])
        return skill.execute(action["params"])

    def _resolve_skill(self, action_type: str):
        # map action type to OpenClaw skill
        pass
```

#### e. State Manager
- Tracks live state of all devices and sensors
- Updated in real time via MQTT events
- Queried by the execution engine during condition checks
- Tracks:
  - Device on/off states
  - Sensor values (temperature, motion, moisture)
  - Robot status and position

#### f. Error Handler (NEW)

Handles failures at every stage of workflow execution.

Responsibilities:
- Retry failed actions (configurable retry count + backoff)
- Fallback behavior when a device is unreachable
- Notify the user in plain language (Consumer mode) or with technical detail (Power User mode)
- Mark workflow as paused/failed in the state manager
- Log all errors to the audit log

```python
class ErrorHandler:
    def handle(self, error: Exception, context: dict):
        self.log_to_audit(error, context)
        if self.should_retry(context):
            return self.retry(context)
        self.notify_user(context["user_id"], error)
        self.mark_workflow_failed(context["workflow_id"])
```

#### g. Audit Log (NEW)

A tamper-evident record of every meaningful event in the system.

Tracks:
- Workflow created / edited / deleted (by whom, when)
- Workflow executed (trigger source, actions taken, result)
- Errors and retries
- User mode changes
- Device state changes

Consumer-facing surface: "Your bedroom light was turned on automatically at 10:04 PM because motion was detected."

Power User surface: Full structured log with timestamps, workflow IDs, and action payloads.

#### h. Simulation Engine

Provides virtual devices and sensors for development and demo purposes.

Simulated sensors:
- Motion detector
- Temperature sensor
- Soil moisture sensor

Simulated devices:
- Light (on/off + brightness)
- Fan (on/off + speed)
- Robot (movement + obstacle detection)

All simulated devices publish to the MQTT broker exactly as real devices would — the execution engine cannot tell the difference.

---

### 5. OpenClaw Layer

- Handles physical execution of actions via skills
- Receives instruction from the OpenClaw Adapter only

Flow: Backend → OpenClaw Adapter → OpenClaw → Skill → Device

---

### 6. Device Layer

#### Simulation Mode
- Virtual devices powered by the Simulation Engine
- Publishes/subscribes to local MQTT broker
- Used for all development and demos

#### Real Device Mode
- ESP32
- Raspberry Pi
- Robots

Communication:
- MQTT (primary — same broker as simulation)
- HTTP fallback for devices that don't support MQTT

---

### 7. Data Layer (Upgraded)

Database:
- SQLite (development and MVP)
- PostgreSQL (production)

Stores:
- Workflows (with full version history)
- Execution logs
- Device states (latest snapshot)
- Audit trail (append-only)
- Workflow templates
- User accounts and mode preferences

---

### 8. Workflow Template Library (NEW)

A curated set of pre-built automations that Consumer mode users can activate in one tap. This is the primary onboarding path for non-technical users.

#### Initial 15 Templates

| # | Name | Trigger | Action |
|---|------|---------|--------|
| 1 | Night lighting | Motion after 10 PM | Light ON → delay 5 min → OFF |
| 2 | Temperature alert | Temp > 30°C | Fan ON + notify user |
| 3 | Smart irrigation | Moisture low + morning | Pump ON → delay 10 min → OFF |
| 4 | Security mode | Mode active + motion | Lights + camera + alert |
| 5 | Robot obstacle stop | Obstacle detected | Stop → turn 90° |
| 6 | Good morning | Time = 7:00 AM | Lights ON at 50% brightness |
| 7 | Energy saver | No motion for 30 min | All lights OFF |
| 8 | Plant care reminder | Moisture critical low | Notify user |
| 9 | Welcome home | Door sensor open | Lights ON + fan ON |
| 10 | Bedtime mode | Time = 11:00 PM | All devices OFF |
| 11 | Overheat protection | Temp > 40°C | Fan max speed + alert |
| 12 | Rain delay | Rain sensor active | Suspend irrigation |
| 13 | Robot patrol | Time trigger | Robot follows patrol path |
| 14 | Morning cool-down | Temp > 28°C + morning | Fan ON until temp < 25°C |
| 15 | Intruder alert | Motion + night + armed | Alert + lights flash |

Templates are stored in the data layer and are read-only. Users activate a copy, which becomes an editable workflow in their account.

---

## 🔄 System Flows

### Chat → Automation (Consumer)

User (chat) → API Gateway → AI Layer → Workflow JSON → Workflow Manager → Execution Engine

### Chat → Automation (Power User)

User (chat or JSON editor) → API Gateway → Workflow Manager → Execution Engine

### Event → Action

Sensor/Device → MQTT Broker → Event Bus → Execution Engine → Condition Check (State Manager) → OpenClaw Adapter → OpenClaw → Device

### Error Flow

Execution Engine failure → Error Handler → Retry? → Audit Log → User Notification

### Template Activation

User selects template → Copy created in Workflow Manager → User can edit (Maker/Power User) or activate as-is (Consumer)

---

## 🧩 Workflow Schema (Expanded)

```json
{
  "id": "uuid",
  "name": "Night Lighting",
  "version": 3,
  "enabled": true,
  "user_mode_origin": "consumer",
  "trigger": {
    "type": "mqtt_event",
    "topic": "sensors/motion",
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
    {
      "type": "device_control",
      "device": "light_bedroom",
      "command": "on"
    },
    {
      "type": "delay",
      "seconds": 300
    },
    {
      "type": "device_control",
      "device": "light_bedroom",
      "command": "off"
    }
  ],
  "error_policy": {
    "retry_count": 2,
    "retry_backoff_seconds": 5,
    "on_failure": "notify_user"
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

## 🔥 Supported Workflow Features

- MQTT event triggers
- Time-based triggers (cron-style)
- Manual triggers (button in UI)
- Conditions: time window, numeric threshold, device state
- Delays between actions
- Multiple sequential and parallel actions
- Mode/state-based logic
- Robotics movement actions
- User notifications (in-app + push)
- Error retry policy per workflow
- Workflow versioning and rollback

---

## 🎯 MVP Scope

### Must Have
- User mode layer (Consumer, Maker, Power User)
- API gateway with JWT auth
- Chat → workflow generation (AI layer)
- Workflow template library (15 templates)
- Visual builder (Maker mode)
- Execution engine with MQTT event bus
- Error handler + audit log
- Simulation engine
- OpenClaw adapter
- Dashboard (mode-appropriate)

### Not in MVP
- Marketplace
- Multi-user / team accounts
- Cloud sync
- Mobile app
- Advanced robotics control

---

## ⚡ Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | FastAPI (Python) | Async, fast, great middleware support |
| Frontend | React / Next.js | Component-based, easy mode-switching |
| Event Bus | MQTT (mosquitto) | Locked in — not Redis |
| Auth | JWT via python-jose | FastAPI middleware |
| Database | SQLite → PostgreSQL | SQLite for dev, Postgres for prod |
| Simulation | Python classes + paho-mqtt | Publishes to real MQTT broker |
| AI | Anthropic API (Claude) | NL → workflow JSON |

---

## 🧠 Key Design Principles

1. **Decouple from OpenClaw** — all execution goes through the adapter, never direct calls
2. **Event-driven architecture** — MQTT is the nervous system of the platform
3. **Simulation-first development** — build and test everything against virtual devices
4. **AI assists, never executes** — AI produces workflow JSON; the execution engine runs it
5. **Mode-adaptive UI** — the same system serves a grandparent and a firmware engineer
6. **Fail gracefully** — every workflow has an error policy; no silent failures

---

## 🚀 Development Roadmap (Revised)

### Week 1 — Foundation
- Backend skeleton (FastAPI project structure)
- Expanded workflow schema (with error policy, versioning fields)
- MQTT event bus setup (local mosquitto broker)
- Simulation engine (all sensors and devices publishing to MQTT)
- SQLite data layer with all tables

### Week 2 — Core Engine
- Execution engine (triggers, conditions, actions, delays)
- State manager (live device/sensor state from MQTT)
- Error handler (retry logic, failure states)
- Audit log (append-only event store)
- API gateway + JWT auth middleware

### Week 3 — Intelligence + Integration
- AI workflow generation (Claude API, NL → JSON with schema validation)
- Workflow template library (15 templates seeded in DB)
- OpenClaw adapter (action type mapping to skills)
- OpenClaw integration and end-to-end test

### Week 4 — Frontend
- User mode layer (Consumer / Maker / Power User switching)
- Chat interface (Consumer mode)
- Visual workflow builder (Maker mode)
- JSON editor (Power User mode)
- Dashboard (mode-appropriate device + system state)
- Template browser (Consumer onboarding)

---

## 💥 Product Vision

A unified platform that makes IoT and robotics automation accessible to everyone:
- A consumer activates a template and their home responds intelligently
- A maker builds custom automations with a visual editor
- A developer integrates directly via JSON and the API
- All three are using the same execution engine under the hood

---

## 🔮 Future Features

- AI proactive suggestions ("You usually turn on the fan at 3 PM — want me to automate this?")
- Context awareness (location, calendar, weather)
- Mobile app (React Native)
- Skill marketplace
- Cloud sync and multi-device support
- Advanced robotics control (path planning, multi-robot coordination)
- Multi-user / team accounts with role-based access
- Webhook triggers (integrate with external services)

---

## 🧠 Summary

This system transforms:

> User intent → Structured workflows → Real-world automation

Built on:
- **OpenClaw** — execution engine
- **AI (Claude)** — natural language to workflow creation
- **MQTT** — event-driven nervous system
- **Simulation** — hardware-free development
- **User modes** — one platform, every skill level
