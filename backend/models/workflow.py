from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime
from sqlalchemy.orm import DeclarativeBase
import json
import uuid


# ── SQLAlchemy Base ────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class WorkflowORM(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    version = Column(Integer, default=1)
    enabled = Column(Boolean, default=True)
    user_mode_origin = Column(String, default="consumer")
    trigger_json = Column(Text, nullable=False)
    conditions_json = Column(Text, default="[]")
    actions_json = Column(Text, nullable=False)
    error_policy_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class Trigger(BaseModel):
    type: str  # mqtt_event | time | manual
    topic: Optional[str] = None
    condition: Optional[str] = None
    cron: Optional[str] = None  # for time triggers


class Condition(BaseModel):
    type: str  # time | numeric | state
    field: Optional[str] = None
    operator: Optional[str] = None  # gt, lt, eq, gte, lte
    value: Optional[Any] = None
    after: Optional[str] = None   # "22:00"
    before: Optional[str] = None  # "06:00"


class Action(BaseModel):
    type: str  # device_control | delay | notify | robot_move
    device: Optional[str] = None
    command: Optional[str] = None
    params: Optional[dict] = None
    seconds: Optional[int] = None   # for delay actions
    message: Optional[str] = None   # for notify actions


class ErrorPolicy(BaseModel):
    retry_count: int = 2
    retry_backoff_seconds: int = 5
    on_failure: str = "notify_user"  # notify_user | pause | ignore


class WorkflowCreate(BaseModel):
    name: str
    enabled: bool = True
    user_mode_origin: str = "consumer"
    trigger: Trigger
    conditions: List[Condition] = []
    actions: List[Action]
    error_policy: ErrorPolicy = Field(default_factory=ErrorPolicy)


class WorkflowRead(BaseModel):
    id: str
    name: str
    version: int
    enabled: bool
    user_mode_origin: str
    trigger: Trigger
    conditions: List[Condition]
    actions: List[Action]
    error_policy: ErrorPolicy
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj: WorkflowORM) -> WorkflowRead:
        return cls(
            id=obj.id,
            name=obj.name,
            version=obj.version,
            enabled=obj.enabled,
            user_mode_origin=obj.user_mode_origin,
            trigger=Trigger(**json.loads(obj.trigger_json)),
            conditions=[Condition(**c) for c in json.loads(obj.conditions_json)],
            actions=[Action(**a) for a in json.loads(obj.actions_json)],
            error_policy=ErrorPolicy(**json.loads(obj.error_policy_json)),
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )
