import hashlib
import uuid
import sqlite3
from . import database


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def generate_token() -> str:
    return uuid.uuid4().hex


def fetch_one(query: str, params: tuple = ()) -> sqlite3.Row | None:
    with database.get_connection() as conn:
        cursor = conn.execute(query, params)
        return cursor.fetchone()


def get_user_by_email(email: str) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM users WHERE email = ?", (email,))


def get_user_by_token(token: str) -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM users WHERE auth_token = ?", (token,))


def create_user(first_name: str, last_name: str, email: str, password: str) -> sqlite3.Row:
    password_hash = hash_password(password)
    auth_token = generate_token()
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (first_name, last_name, email, password_hash, auth_token) VALUES (?, ?, ?, ?, ?)",
            (first_name, last_name, email, password_hash, auth_token),
        )
        conn.commit()
        user_id = cursor.lastrowid
    return fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))


def update_auth_token(user_id: int) -> str:
    token = generate_token()
    with database.get_connection() as conn:
        conn.execute("UPDATE users SET auth_token = ? WHERE id = ?", (token, user_id))
        conn.commit()
    return token


def authenticate_user(email: str, password: str) -> sqlite3.Row | None:
    user_row = get_user_by_email(email)
    if not user_row:
        return None
    if not verify_password(password, user_row["password_hash"]):
        return None
    return user_row

DEMO_USER_EMAIL = "demo@dataabsorber.local"

def get_demo_user() -> sqlite3.Row | None:
    return fetch_one("SELECT * FROM users WHERE email = ?", (DEMO_USER_EMAIL,))

def ensure_demo_user() -> sqlite3.Row:
    demo_user = get_demo_user()
    if demo_user:
        return demo_user
    return create_user("Demo", "Student", DEMO_USER_EMAIL, "demo")
