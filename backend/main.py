from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from . import auth, crud, database, models

app = FastAPI(title="Data Absorber Student API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/uploads", StaticFiles(directory=Path(__file__).resolve().parent / "uploads", check_dir=False), name="uploads")

@app.on_event("startup")
async def startup_event() -> None:
    database.init_db()
    auth.ensure_demo_user()


def get_authorization_header(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        return "demo"
    return authorization.removeprefix("Bearer ").strip()


def get_current_user(token: str = Depends(get_authorization_header)) -> models.User:
    if token == "demo":
        demo_user = auth.get_demo_user()
        if not demo_user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Demo user not available")
        return models.User(**dict(demo_user))

    user_row = auth.get_user_by_token(token)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    return models.User(**dict(user_row))

@app.post("/api/auth/signup", response_model=models.AuthResponse)
def sign_up(user_data: models.UserCreate):
    existing = auth.get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    created = auth.create_user(user_data.first_name, user_data.last_name, user_data.email, user_data.password)
    return models.AuthResponse(token=created["auth_token"], user=models.User(**dict(created)))

@app.post("/api/auth/login", response_model=models.AuthResponse)
def login(user_data: models.UserLogin):
    user_row = auth.authenticate_user(user_data.email, user_data.password)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    token = auth.update_auth_token(user_row["id"])
    user_row = auth.get_user_by_email(user_data.email)
    return models.AuthResponse(token=token, user=models.User(**dict(user_row)))

@app.get("/api/auth/me", response_model=models.User)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/api/subjects", response_model=list[models.Subject])
def list_subjects(current_user: models.User = Depends(get_current_user)):
    return crud.get_subjects(current_user.id)

@app.post("/api/subjects", response_model=models.Subject)
def create_subject(subject: models.SubjectCreate, current_user: models.User = Depends(get_current_user)):
    return crud.create_subject(subject, current_user.id)

@app.get("/api/notes", response_model=list[models.Note])
def list_notes(current_user: models.User = Depends(get_current_user)):
    return crud.get_notes(current_user.id)

@app.post("/api/notes", response_model=models.Note)
def create_note(note: models.NoteCreate, current_user: models.User = Depends(get_current_user)):
    return crud.create_note(note, current_user.id)

@app.put("/api/notes/{note_id}", response_model=models.Note)
def update_note(note_id: int, note: models.NoteCreate, current_user: models.User = Depends(get_current_user)):
    updated = crud.update_note(note_id, note, current_user.id)
    if not updated:
        raise HTTPException(status_code=404, detail="Note not found")
    return updated

@app.get("/api/documents", response_model=list[models.Document])
def list_documents(current_user: models.User = Depends(get_current_user)):
    return crud.get_documents(current_user.id)

@app.post("/api/documents", response_model=models.Document)
def create_document(document: models.DocumentCreate, current_user: models.User = Depends(get_current_user)):
    return crud.create_document(document, current_user.id)

@app.get("/api/assignments", response_model=list[models.Assignment])
def list_assignments(current_user: models.User = Depends(get_current_user)):
    return crud.get_assignments(current_user.id)

@app.post("/api/assignments", response_model=models.Assignment)
def create_assignment(assignment: models.AssignmentCreate, current_user: models.User = Depends(get_current_user)):
    return crud.create_assignment(assignment, current_user.id)

@app.put("/api/assignments/{assignment_id}", response_model=models.Assignment)
def update_assignment(assignment_id: int, assignment: models.AssignmentCreate, current_user: models.User = Depends(get_current_user)):
    updated = crud.update_assignment(assignment_id, assignment, current_user.id)
    if not updated:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return updated

@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, current_user: models.User = Depends(get_current_user)):
    if not crud.delete_subject(subject_id, current_user.id):
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True}

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, current_user: models.User = Depends(get_current_user)):
    if not crud.delete_note(note_id, current_user.id):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True}

@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, current_user: models.User = Depends(get_current_user)):
    if not crud.delete_document(document_id, current_user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}

@app.get("/api/documents/{document_id}/download")
def download_document(document_id: int, current_user: models.User = Depends(get_current_user)):
    document = crud.get_document(document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    filename = document.get("saved_file_name") or document.get("file_name")
    upload_dir = Path(__file__).resolve().parent / "uploads"
    file_path = upload_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path, filename=document.get("file_name"))

@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, current_user: models.User = Depends(get_current_user)):
    if not crud.delete_assignment(assignment_id, current_user.id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True}

@app.get("/api/events", response_model=list[models.Event])
def list_events(current_user: models.User = Depends(get_current_user)):
    return crud.get_events(current_user.id)

@app.post("/api/events", response_model=models.Event)
def create_event(event: models.EventCreate, current_user: models.User = Depends(get_current_user)):
    return crud.create_event(event, current_user.id)

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, current_user: models.User = Depends(get_current_user)):
    if not crud.delete_event(event_id, current_user.id):
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}

@app.post("/api/documents/upload", response_model=models.Document)
def upload_document(
    title: str = Form(...),
    subject_id: int | None = Form(None),
    file_name: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    upload_dir = Path(__file__).resolve().parent / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name
    saved_path = upload_dir / safe_filename
    with saved_path.open("wb") as buffer:
        buffer.write(file.file.read())

    validated_file_name = file_name.strip() if file_name and file_name.strip() else saved_path.name
    document_data = models.DocumentCreate(
        title=title,
        subject_id=subject_id,
        file_name=validated_file_name,
        saved_file_name=saved_path.name,
    )
    return crud.create_document(document_data, current_user.id)
