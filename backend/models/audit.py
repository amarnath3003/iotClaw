from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from .workflow import Base
import uuid


class AuditLogORM(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String, nullable=False)   # workflow_created, workflow_executed, error, etc.
    workflow_id = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    detail = Column(Text, nullable=True)           # JSON string with extra context
    created_at = Column(DateTime, default=datetime.utcnow)
