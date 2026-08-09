import asyncio
from http.cookies import SimpleCookie
import sqlite3

import pytest
from fastapi import HTTPException, Request, Response

from vision_app.auth import AuthStore
from vision_app.main import (
    CreateUserPayload,
    LoginPayload,
    admin_user,
    create_user,
    current_user,
    login,
)


@pytest.fixture
def store(tmp_path):
    return AuthStore(
        tmp_path / "users.db",
        session_seconds=3600,
        initial_admin_username="admin",
        initial_admin_password="correct-horse-battery",
    )


def _request_with_cookie(name: str, value: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(b"cookie", f"{name}={value}".encode("ascii"))],
        }
    )


def test_password_is_argon2_hashed_in_sqlite(store):
    with sqlite3.connect(store.path) as connection:
        encoded = connection.execute(
            "SELECT password_hash FROM users WHERE username = 'admin'"
        ).fetchone()[0]

    assert encoded.startswith("$argon2id$")
    assert "correct-horse-battery" not in encoded


def test_session_is_required_and_resolves_user(store):
    empty_request = _request_with_cookie("camera_session", "")
    with pytest.raises(HTTPException) as error:
        current_user(empty_request, store)
    assert error.value.status_code == 401

    admin = store.authenticate("admin", "correct-horse-battery")
    token = store.create_session(admin["id"])
    authenticated = current_user(_request_with_cookie("camera_session", token), store)
    assert authenticated["username"] == "admin"
    assert authenticated["role"] == "admin"


def test_login_sets_http_only_cookie_and_admin_can_create_user(store):
    response = Response()
    payload = asyncio.run(
        login(
            LoginPayload(username="admin", password="correct-horse-battery"),
            response,
            store,
        )
    )
    assert payload["user"]["role"] == "admin"
    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=strict" in set_cookie

    cookie = SimpleCookie()
    cookie.load(set_cookie)
    token = cookie["camera_session"].value
    authenticated = current_user(_request_with_cookie("camera_session", token), store)
    created = asyncio.run(
        create_user(
            CreateUserPayload(
                username="operator",
                password="another-secure-password",
                role="user",
            ),
            admin_user(authenticated),
            store,
        )
    )
    assert created["user"]["role"] == "user"
    assert {user["username"] for user in created["users"]} == {"admin", "operator"}


def test_normal_user_is_rejected_by_admin_dependency(store):
    operator = store.create_user("operator", "another-secure-password", "user")
    with pytest.raises(HTTPException) as error:
        admin_user(operator)
    assert error.value.status_code == 403


def test_login_rejects_wrong_password(store):
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            login(
                LoginPayload(username="admin", password="wrong-password"),
                Response(),
                store,
            )
        )

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid username or password"
