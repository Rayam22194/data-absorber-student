import sqlite3
from . import database
from .models import EventCreate, SubjectCreate, NoteCreate, DocumentCreate, AssignmentCreate


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    with database.get_connection() as conn:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    with database.get_connection() as conn:
        cursor = conn.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row is not None else None


def create_subject(subject: SubjectCreate, user_id: int) -> dict:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO subjects (user_id, name, description) VALUES (?, ?, ?)",
            (user_id, subject.name, subject.description),
        )
        conn.commit()
        subject_id = cursor.lastrowid
    return fetch_one("SELECT * FROM subjects WHERE id = ? AND user_id = ?", (subject_id, user_id))


def get_subjects(user_id: int) -> list[dict]:
    rows = fetch_all("SELECT * FROM subjects WHERE user_id = ? ORDER BY id DESC", (user_id,))
    return [dict(row) for row in rows]


def create_note(note: NoteCreate, user_id: int) -> dict:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO notes (user_id, subject_id, title, content) VALUES (?, ?, ?, ?)",
            (user_id, note.subject_id, note.title, note.content),
        )
        conn.commit()
        note_id = cursor.lastrowid
    return fetch_one("SELECT * FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))


def update_note(note_id: int, note: NoteCreate, user_id: int) -> dict | None:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "UPDATE notes SET subject_id = ?, title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (note.subject_id, note.title, note.content, note_id, user_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return None
    return fetch_one("SELECT * FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))


def get_notes(user_id: int) -> list[dict]:
    rows = fetch_all("SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
    return [dict(row) for row in rows]


def create_document(document: DocumentCreate, user_id: int) -> dict:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO documents (user_id, subject_id, title, file_name, saved_file_name) VALUES (?, ?, ?, ?, ?)",
            (user_id, document.subject_id, document.title, document.file_name, document.saved_file_name),
        )
        conn.commit()
        doc_id = cursor.lastrowid
    return fetch_one("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))


def get_document(document_id: int, user_id: int) -> dict | None:
    row = fetch_one("SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user_id))
    return dict(row) if row else None


def get_documents(user_id: int) -> list[dict]:
    rows = fetch_all("SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC", (user_id,))
    return [dict(row) for row in rows]


def create_assignment(assignment: AssignmentCreate, user_id: int) -> dict:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO assignments (user_id, subject_id, title, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, assignment.subject_id, assignment.title, str(assignment.due_date), assignment.status, assignment.notes),
        )
        conn.commit()
        assignment_id = cursor.lastrowid
    return fetch_one("SELECT * FROM assignments WHERE id = ? AND user_id = ?", (assignment_id, user_id))


def update_assignment(assignment_id: int, assignment: AssignmentCreate, user_id: int) -> dict | None:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "UPDATE assignments SET subject_id = ?, title = ?, due_date = ?, status = ?, notes = ? WHERE id = ? AND user_id = ?",
            (assignment.subject_id, assignment.title, str(assignment.due_date), assignment.status, assignment.notes, assignment_id, user_id),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return None
    return fetch_one("SELECT * FROM assignments WHERE id = ? AND user_id = ?", (assignment_id, user_id))


def get_assignments(user_id: int) -> list[dict]:
    rows = fetch_all("SELECT * FROM assignments WHERE user_id = ? ORDER BY due_date ASC", (user_id,))
    return [dict(row) for row in rows]


def create_event(event: EventCreate, user_id: int) -> dict:
    with database.get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO events (user_id, subject_id, title, event_date, type, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, event.subject_id, event.title, str(event.event_date), event.type, event.notes),
        )
        conn.commit()
        event_id = cursor.lastrowid
    return fetch_one("SELECT * FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))


def get_events(user_id: int) -> list[dict]:
    rows = fetch_all("SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC", (user_id,))
    return [dict(row) for row in rows]


def delete_subject(subject_id: int, user_id: int) -> bool:
    with database.get_connection() as conn:
        cursor = conn.execute("DELETE FROM subjects WHERE id = ? AND user_id = ?", (subject_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_note(note_id: int, user_id: int) -> bool:
    with database.get_connection() as conn:
        cursor = conn.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_document(document_id: int, user_id: int) -> bool:
    with database.get_connection() as conn:
        cursor = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_assignment(assignment_id: int, user_id: int) -> bool:
    with database.get_connection() as conn:
        cursor = conn.execute("DELETE FROM assignments WHERE id = ? AND user_id = ?", (assignment_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_event(event_id: int, user_id: int) -> bool:
    with database.get_connection() as conn:
        cursor = conn.execute("DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
