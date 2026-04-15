import json
import logging
from datetime import datetime
from backend.db.database import AsyncSessionLocal
from backend.models.audit import AuditLogORM

logger = logging.getLogger(__name__)


async def write_audit(
    event_type: str,
    workflow_id: str | None = None,
    user_id: str | None = None,
    detail: dict | None = None,
):
    """Append an immutable entry to the audit log."""
    try:
        async with AsyncSessionLocal() as session:
            entry = AuditLogORM(
                event_type=event_type,
                workflow_id=workflow_id,
                user_id=user_id,
                detail=json.dumps(detail or {}),
            )
            session.add(entry)
            await session.commit()
    except Exception as e:
        logger.error(f"Audit log write failed: {e}")
