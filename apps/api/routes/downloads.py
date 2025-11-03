"""
Downloads Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class DownloadRequest(BaseModel):
    url: str
    mode: Optional[str] = None

class DownloadResponse(BaseModel):
    id: str
    url: str
    status: str

downloads_db: dict[str, dict] = {}

@router.post("", response_model=DownloadResponse)
async def queue_download(request: DownloadRequest):
    """Queue a download"""
    download_id = f"dl_{len(downloads_db)}"
    
    download = {
        "id": download_id,
        "url": request.url,
        "mode": request.mode,
        "status": "queued",
    }
    
    downloads_db[download_id] = download
    return download

@router.get("/{download_id}", response_model=DownloadResponse)
async def get_download(download_id: str):
    """Get download status"""
    if download_id not in downloads_db:
        raise HTTPException(status_code=404, detail="Download not found")
    return downloads_db[download_id]

