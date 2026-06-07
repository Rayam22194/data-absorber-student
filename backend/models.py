from datetime import date
from pydantic import BaseModel

class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    id: int

    class Config:
        orm_mode = True

class AuthResponse(BaseModel):
    token: str
    user: User

class SubjectBase(BaseModel):
    name: str
    description: str | None = None

class SubjectCreate(SubjectBase):
    pass

class Subject(SubjectBase):
    id: int

    class Config:
        orm_mode = True

class NoteBase(BaseModel):
    title: str
    subject_id: int | None = None
    content: str

class NoteCreate(NoteBase):
    pass

class Note(NoteBase):
    id: int

    class Config:
        orm_mode = True

class DocumentBase(BaseModel):
    title: str
    subject_id: int | None = None
    file_name: str
    saved_file_name: str | None = None

class DocumentCreate(DocumentBase):
    pass

class Document(DocumentBase):
    id: int

    class Config:
        orm_mode = True

class AssignmentBase(BaseModel):
    title: str
    subject_id: int | None = None
    due_date: date
    status: str = "pending"
    notes: str | None = None

class AssignmentCreate(AssignmentBase):
    pass

class Assignment(AssignmentBase):
    id: int

    class Config:
        orm_mode = True

class EventBase(BaseModel):
    title: str
    subject_id: int | None = None
    event_date: date
    type: str = "study"
    notes: str | None = None

class EventCreate(EventBase):
    pass

class Event(EventBase):
    id: int

    class Config:
        orm_mode = True
