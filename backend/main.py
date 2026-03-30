from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from config.settings import settings
from backend.core.execution_engine import ExecutionEngine
from backend.core.state_manager import StateManager
from backend.models.workflow import Base, WorkflowCreate, WorkflowORM, WorkflowRead
from backend.simulation.engine import SimulationEngine

app = FastAPI(title="IoT Claw Automation Platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine(settings.database_url, echo=False)
Base.metadata.create_all(engine)

state_manager = StateManager()
execution_engine = ExecutionEngine(state_manager)
simulation_engine = SimulationEngine()


@app.on_event("startup")
def on_startup():
    simulation_engine.start()


@app.on_event("shutdown")
def on_shutdown():
    simulation_engine.stop()


@app.get("/health")
def health():
    return {"status": "ok", "mode": settings.app_mode}


@app.get("/state")
def state():
    sim_state = simulation_engine.snapshot()
    for key, value in sim_state.items():
        state_manager.set_state(key, value)
    return state_manager.all_states()


@app.get("/workflows", response_model=list[WorkflowRead])
def list_workflows():
    with Session(engine) as session:
        rows = session.scalars(select(WorkflowORM).order_by(WorkflowORM.id.desc())).all()
        return [WorkflowRead.model_validate(row) for row in rows]


@app.post("/workflows", response_model=WorkflowRead)
def create_workflow(payload: WorkflowCreate):
    with Session(engine) as session:
        row = WorkflowORM(name=payload.name, definition=payload.definition, enabled=payload.enabled)
        session.add(row)
        session.commit()
        session.refresh(row)
        return WorkflowRead.model_validate(row)


@app.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: int):
    with Session(engine) as session:
        row = session.get(WorkflowORM, workflow_id)
        if not row:
            raise HTTPException(status_code=404, detail="Workflow not found")
        result = execution_engine.run({"id": row.id, **(row.definition or {})})
        return {
            "workflow_id": result.workflow_id,
            "triggered": result.triggered,
            "message": result.message,
            "state": state_manager.all_states(),
        }


@app.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: int):
    with Session(engine) as session:
        row = session.get(WorkflowORM, workflow_id)
        if not row:
            raise HTTPException(status_code=404, detail="Workflow not found")
        session.delete(row)
        session.commit()
        return {"deleted": workflow_id}
