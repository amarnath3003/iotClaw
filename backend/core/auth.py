"""
Auth — JWT-based sessions with SQLite user storage.
Passwords hashed with bcrypt. Tokens expire per .env setting.
"""

import os
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger(__name__)

SECRET_KEY  = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM   = "HS256"
EXPIRE_MINS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2     = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "openclaw.db")


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_auth_tables():
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            username   TEXT UNIQUE NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            hashed_pw  TEXT NOT NULL,
            role       TEXT DEFAULT 'user',
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ── User CRUD ─────────────────────────────────────────────────────────────────

def create_user(username: str, email: str, password: str, role: str = "user") -> dict:
    import uuid
    uid  = str(uuid.uuid4())
    hpw  = hash_password(password)
    conn = _conn()
    try:
        conn.execute(
            "INSERT INTO users (id,username,email,hashed_pw,role) VALUES (?,?,?,?,?)",
            (uid, username, email, hpw, role),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return _row_to_user(row)
    except sqlite3.IntegrityError as e:
        raise ValueError("Username or email already exists") from e
    finally:
        conn.close()


def get_user_by_username(username: str) -> Optional[dict]:
    conn = _conn()
    row  = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    return _row_to_user(row) if row else None


def get_user_by_id(uid: str) -> Optional[dict]:
    conn = _conn()
    row  = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return _row_to_user(row) if row else None


def list_users() -> list:
    conn = _conn()
    rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return [_row_to_user(r) for r in rows]


def _row_to_user(row) -> dict:
    return {
        "id":         row["id"],
        "username":   row["username"],
        "email":      row["email"],
        "role":       row["role"],
        "created_at": row["created_at"],
    }


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_token(user_id: str, username: str, role: str) -> str:
    expire  = datetime.utcnow() + timedelta(minutes=EXPIRE_MINS)
    payload = {"sub": user_id, "username": username, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2)) -> dict:
    """Dependency — raises 401 if token missing or invalid."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_current_user_optional(token: str = Depends(oauth2)) -> Optional[dict]:
    """Dependency — returns None instead of raising if not authenticated."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return get_user_by_id(payload.get("sub", ""))
