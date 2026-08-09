from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import re
import secrets
import sqlite3
from threading import Lock
from time import time
from typing import Any

from pwdlib import PasswordHash


password_hash = PasswordHash.recommended()


class UserExistsError(ValueError):
    pass


class AuthStore:
    """SQLite-backed users and opaque server-side sessions."""

    def __init__(
        self,
        path: Path,
        session_seconds: int,
        initial_admin_username: str = "",
        initial_admin_password: str = "",
    ) -> None:
        self.path = path
        self.session_seconds = session_seconds
        self._write_lock = Lock()
        self._dummy_hash = password_hash.hash(secrets.token_urlsafe(24))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()
        if self.user_count() == 0 and initial_admin_password:
            self.create_user(initial_admin_username or "admin", initial_admin_password, "admin")

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
                    ON sessions(expires_at);
                """
            )

    @staticmethod
    def _public_user(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": int(row["id"]),
            "username": str(row["username"]),
            "role": str(row["role"]),
            "createdAt": int(row["created_at"]),
        }

    @staticmethod
    def _token_hash(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    def user_count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()
        return int(row["count"])

    def create_user(self, username: str, password: str, role: str) -> dict[str, Any]:
        username = username.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", username):
            raise ValueError("Invalid username")
        if not 12 <= len(password) <= 128:
            raise ValueError("Password must be 12-128 characters")
        if role not in {"user", "admin"}:
            raise ValueError("Invalid role")
        now = int(time())
        encoded_password = password_hash.hash(password)
        try:
            with self._write_lock, self._connect() as connection:
                cursor = connection.execute(
                    "INSERT INTO users(username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
                    (username, encoded_password, role, now),
                )
                row = connection.execute(
                    "SELECT id, username, role, created_at FROM users WHERE id = ?",
                    (cursor.lastrowid,),
                ).fetchone()
        except sqlite3.IntegrityError as error:
            raise UserExistsError("Username already exists") from error
        return self._public_user(row)

    def list_users(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, username, role, created_at FROM users ORDER BY username COLLATE NOCASE"
            ).fetchall()
        return [self._public_user(row) for row in rows]

    def authenticate(self, username: str, password: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        candidate_hash = str(row["password_hash"]) if row else self._dummy_hash
        try:
            valid = password_hash.verify(password, candidate_hash)
        except Exception:
            valid = False
        return self._public_user(row) if row is not None and valid else None

    def create_session(self, user_id: int) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time())
        with self._write_lock, self._connect() as connection:
            connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            connection.execute(
                "INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (self._token_hash(token), user_id, now, now + self.session_seconds),
            )
        return token

    def user_for_session(self, token: str) -> dict[str, Any] | None:
        now = int(time())
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT users.id, users.username, users.role, users.created_at
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (self._token_hash(token), now),
            ).fetchone()
        return self._public_user(row) if row else None

    def delete_session(self, token: str) -> None:
        with self._write_lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (self._token_hash(token),),
            )
