from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, Integer, JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class WorkflowORM(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    definition: Mapped[dict] = mapped_column(JSON, nullable=False, default={})
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WorkflowCreate(BaseModel):
    name: str
    definition: dict
    enabled: bool = True


class WorkflowRead(WorkflowCreate):
    id: int

    class Config:
        from_attributes = True
