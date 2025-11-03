"""
Workspace Routes - CRUD operations for workspaces and tabs
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.models import Workspace, Tab

router = APIRouter()

# Keep mock for backward compatibility during migration
workspaces_db: dict[str, dict] = {}
tabs_db: dict[str, List[dict]] = {}

class WorkspaceCreate(BaseModel):
    name: str
    mode: str
    vpn_profile_id: Optional[str] = None
    settings_json: Optional[dict] = None

class WorkspaceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    mode: str
    vpn_profile_id: Optional[str]
    settings_json: Optional[dict]
    created_at: str

class TabCreate(BaseModel):
    url: str
    title: Optional[str] = None

class TabResponse(BaseModel):
    id: str
    workspace_id: str
    url: str
    title: str
    status: str
    created_at: str

@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(user_id: str, db: Session = Depends(get_db)):
    """List all workspaces for a user"""
    workspaces = db.query(Workspace).filter(Workspace.user_id == user_id).all()
    return [
        WorkspaceResponse(
            id=w.id,
            user_id=w.user_id,
            name=w.name,
            mode=w.mode,
            vpn_profile_id=w.vpn_profile_id,
            settings_json=w.settings_json or {},
            created_at=w.created_at.isoformat(),
        )
        for w in workspaces
    ]

@router.post("", response_model=WorkspaceResponse)
async def create_workspace(request: WorkspaceCreate, user_id: str, db: Session = Depends(get_db)):
    """Create a new workspace"""
    workspace = Workspace(
        user_id=user_id,
        name=request.name,
        mode=request.mode,
        vpn_profile_id=request.vpn_profile_id,
        settings_json=request.settings_json or {},
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    
    return WorkspaceResponse(
        id=workspace.id,
        user_id=workspace.user_id,
        name=workspace.name,
        mode=workspace.mode,
        vpn_profile_id=workspace.vpn_profile_id,
        settings_json=workspace.settings_json or {},
        created_at=workspace.created_at.isoformat(),
    )

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Get workspace by ID"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return WorkspaceResponse(
        id=workspace.id,
        user_id=workspace.user_id,
        name=workspace.name,
        mode=workspace.mode,
        vpn_profile_id=workspace.vpn_profile_id,
        settings_json=workspace.settings_json or {},
        created_at=workspace.created_at.isoformat(),
    )

@router.post("/{workspace_id}/tabs", response_model=TabResponse)
async def create_tab(workspace_id: str, request: TabCreate, db: Session = Depends(get_db)):
    """Create a new tab in workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    tab = Tab(
        workspace_id=workspace_id,
        url=request.url,
        title=request.title or "New Tab",
        status="active",
    )
    db.add(tab)
    db.commit()
    db.refresh(tab)
    
    return TabResponse(
        id=tab.id,
        workspace_id=tab.workspace_id,
        url=tab.url,
        title=tab.title,
        status=tab.status,
        created_at=tab.created_at.isoformat(),
    )

@router.get("/{workspace_id}/tabs", response_model=List[TabResponse])
async def list_tabs(workspace_id: str, db: Session = Depends(get_db)):
    """List all tabs in workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    tabs = db.query(Tab).filter(Tab.workspace_id == workspace_id).all()
    return [
        TabResponse(
            id=t.id,
            workspace_id=t.workspace_id,
            url=t.url,
            title=t.title,
            status=t.status,
            created_at=t.created_at.isoformat(),
        )
        for t in tabs
    ]

@router.websocket("/{workspace_id}/events")
async def workspace_events(websocket: WebSocket, workspace_id: str):
    """WebSocket endpoint for real-time workspace events"""
    await websocket.accept()
    try:
        while True:
            # Send tab updates, agent logs, etc.
            data = await websocket.receive_json()
            # Handle client messages
            await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        pass

