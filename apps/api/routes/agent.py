"""
Agent Routes - Plan, Run, Stream via SSE
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter()

class PlanRequest(BaseModel):
    goal: str
    mode: Optional[str] = None

class RunRequest(BaseModel):
    plan_id: Optional[str] = None
    goal: Optional[str] = None

# Mock data store
plans_db: dict[str, dict] = {}
runs_db: dict[str, dict] = {}

@router.post("/plan")
async def create_plan(request: PlanRequest):
    """Generate a plan from user goal"""
    plan_id = f"plan_{len(plans_db)}"
    
    # TODO: Call agent planner
    plan = {
        "id": plan_id,
        "goal": request.goal,
        "mode": request.mode,
        "steps": [
            {"action": "search", "args": {"query": request.goal}},
            {"action": "summarize", "args": {}},
        ],
        "status": "pending",
    }
    
    plans_db[plan_id] = plan
    return plan

@router.post("/run")
async def start_run(request: RunRequest):
    """Start agent run"""
    run_id = f"run_{len(runs_db)}"
    
    # TODO: Execute agent run
    run = {
        "id": run_id,
        "plan_id": request.plan_id,
        "goal": request.goal,
        "status": "running",
        "started_at": "2024-12-19T00:00:00Z",
    }
    
    runs_db[run_id] = run
    return run

@router.get("/runs/{run_id}")
async def stream_run(run_id: str):
    """Stream agent run updates via SSE"""
    if run_id not in runs_db:
        raise HTTPException(status_code=404, detail="Run not found")
    
    async def generate():
        # Stream updates
        yield f"data: {json.dumps({'type': 'start', 'run_id': run_id})}\n\n"
        
        # Simulate progress
        for i in range(5):
            yield f"data: {json.dumps({'type': 'step', 'step': i, 'status': 'running'})}\n\n"
            await asyncio.sleep(1)
        
        yield f"data: {json.dumps({'type': 'done', 'run_id': run_id})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

import asyncio

