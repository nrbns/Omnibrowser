"""
Notes Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class NoteCreate(BaseModel):
    content: str
    sources: Optional[List[dict]] = None

class NoteResponse(BaseModel):
    id: str
    content: str
    sources: Optional[List[dict]]
    created_at: str

notes_db: dict[str, dict] = {}

@router.post("", response_model=NoteResponse)
async def create_note(request: NoteCreate):
    """Create a note"""
    note_id = f"note_{len(notes_db)}"
    note = {
        "id": note_id,
        "content": request.content,
        "sources": request.sources or [],
        "created_at": "2024-12-19T00:00:00Z",
    }
    notes_db[note_id] = note
    return note

@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    """Get note by ID"""
    if note_id not in notes_db:
        raise HTTPException(status_code=404, detail="Note not found")
    return notes_db[note_id]

