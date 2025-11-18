"""
Context Builder Service - Enhance prompts with relevant context
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def build_memory_context(
    memories: Optional[List[Dict[str, Any]]] = None,
    max_memories: int = 5,
    max_chars_per_memory: int = 300,
) -> Optional[str]:
    """
    Build a context block from memory entries.
    Returns None if no memories provided or empty.
    """
    if not memories or len(memories) == 0:
        return None

    context_lines: List[str] = []
    for mem in memories[:max_memories]:
        value = mem.get("value", "")
        metadata = mem.get("metadata", {})
        title = metadata.get("title") or metadata.get("url", "") or "Memory"
        
        # Truncate if needed
        if isinstance(value, str) and len(value) > max_chars_per_memory:
            value = value[:max_chars_per_memory] + "..."
        elif not isinstance(value, str):
            value = str(value)[:max_chars_per_memory]
        
        url = metadata.get("url", "")
        if url:
            context_lines.append(f"- {title} ({url})\n  {value}")
        else:
            context_lines.append(f"- {title}\n  {value}")

    if not context_lines:
        return None

    return "Relevant memories:\n" + "\n\n".join(context_lines)


def build_recent_agent_runs_context(
    runs: Optional[List[Dict[str, Any]]] = None,
    max_runs: int = 3,
) -> Optional[str]:
    """
    Build a context block from recent agent runs.
    Useful for agents to understand previous interactions.
    """
    if not runs or len(runs) == 0:
        return None

    context_lines: List[str] = []
    for run in runs[:max_runs]:
        prompt = run.get("prompt", "")[:150]  # Truncate
        response = run.get("response", "")
        success = run.get("success", False)
        
        if response:
            response_preview = (response[:150] + "...") if len(response) > 150 else response
            status = "✓" if success else "✗"
            context_lines.append(
                f"{status} Q: {prompt}\n  A: {response_preview}"
            )

    if not context_lines:
        return None

    return "Recent interactions:\n" + "\n".join(context_lines)


def build_tab_context(
    active_tab: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Build context from the currently active tab.
    """
    if not active_tab:
        return None

    url = active_tab.get("url", "")
    title = active_tab.get("title", "")
    
    if not url and not title:
        return None

    parts: List[str] = []
    if title:
        parts.append(f"Page: {title}")
    if url:
        parts.append(f"URL: {url}")

    return "Current page:\n" + "\n".join(parts)


def build_document_context(
    documents: Optional[List[Dict[str, Any]]] = None,
    max_documents: int = 5,
    max_chars_per_document: int = 2000,
) -> Optional[str]:
    """
    Build context from uploaded documents.
    """
    if not documents or len(documents) == 0:
        return None

    context_lines: List[str] = []
    for doc in documents[:max_documents]:
        name = doc.get("name", "Untitled")
        text = doc.get("text", "")
        doc_type = doc.get("type", "unknown")
        
        # Truncate if needed
        if isinstance(text, str) and len(text) > max_chars_per_document:
            text = text[:max_chars_per_document] + "..."
        elif not isinstance(text, str):
            text = str(text)[:max_chars_per_document]
        
        context_lines.append(f"Document: {name} ({doc_type})\n{text}")

    if not context_lines:
        return None

    return "Uploaded documents:\n" + "\n\n---\n\n".join(context_lines)


def build_enhanced_context(
    context_data: Optional[Dict[str, Any]] = None,
    max_memories: int = 5,
    max_runs: int = 3,
) -> str:
    """
    Build an enhanced context block from various context sources.
    Combines memories, agent runs, tab context, etc.
    """
    if not context_data:
        return ""

    context_parts: List[str] = []

    # Memory context
    memories = context_data.get("memories") or context_data.get("memory")
    if memories:
        mem_context = build_memory_context(memories, max_memories)
        if mem_context:
            context_parts.append(mem_context)

    # Agent runs context
    runs = context_data.get("agent_runs") or context_data.get("runs")
    if runs:
        runs_context = build_recent_agent_runs_context(runs, max_runs)
        if runs_context:
            context_parts.append(runs_context)

    # Tab context
    active_tab = context_data.get("active_tab") or context_data.get("tab")
    if active_tab:
        tab_context = build_tab_context(active_tab)
        if tab_context:
            context_parts.append(tab_context)

    # Document context
    documents = context_data.get("documents")
    if documents:
        doc_context = build_document_context(documents, max_documents=5, max_chars_per_document=2000)
        if doc_context:
            context_parts.append(doc_context)

    # Custom context (passed directly)
    custom = context_data.get("custom") or context_data.get("additional")
    if custom:
        if isinstance(custom, str):
            context_parts.append(custom)
        elif isinstance(custom, dict):
            context_parts.append(str(custom))

    if not context_parts:
        return ""

    return "\n\n" + "\n\n---\n\n".join(context_parts) + "\n\n"


def estimate_context_tokens(context: str, chars_per_token: float = 4.0) -> int:
    """
    Rough estimate of token count for context.
    Helps with token budget management.
    """
    if not context:
        return 0
    return int(len(context) / chars_per_token)

