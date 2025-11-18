"""
Unified AI task endpoint (Sprint 2 scaffolding).
Currently routes everything through the OpenAI helper, returning a buffered response.
Streaming + multi-provider routing will be layered on in the next iteration.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Optional, Any, List, Dict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from apps.api.openai_client import get_openai_client
from apps.api.anthropic_client import get_anthropic_client
from apps.api.ollama_client import get_ollama_client
from apps.api.services.search_aggregator import aggregate_search
from apps.api.services.telemetry import record_ai_task_metric
from apps.api.services.ai_policy import (
    select_model_for_task,
    resolve_cost_tier,
    get_fallback_model,
    estimate_cost,
    enforce_token_budget,
    get_system_prompt,
    get_available_providers,
    CostTier,
)
from apps.api.services.rate_limiter import get_rate_limiter, get_client_identifier
from apps.api.services.context_builder import build_enhanced_context, estimate_context_tokens
from apps.api.services.retry import (
    is_retryable_error,
    format_user_friendly_error,
    extract_error_details,
)
from apps.api.services.cache import (
    cache_key,
    hash_context,
    get_cached_response,
    set_cached_response,
    should_cache,
    get_cache_ttl,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class AITaskRequest(BaseModel):
    kind: str = Field(..., description="Task type e.g. search, agent, chat, summary.")
    prompt: str = Field(..., min_length=1)
    mode: Optional[str] = None
    context: Optional[dict] = None
    metadata: Optional[dict] = None
    temperature: Optional[float] = None  # Use policy default if None
    max_tokens: Optional[int] = None  # Use policy default if None


class AITaskResponse(BaseModel):
    text: str
    provider: str
    model: str
    usage: Optional[dict] = None
    latency_ms: int
    citations: Optional[list[dict]] = None
    estimated_cost_usd: Optional[float] = None


def build_stream_payload(
    *,
    event_type: str,
    data: Dict[str, Any],
) -> str:
    import json

    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


@router.post("/ai/task", response_model=AITaskResponse)
async def run_ai_task(request_body: AITaskRequest, request: Request):
    prompt = request_body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt must not be empty.")

    openai = get_openai_client()
    if not openai.api_key:
        raise HTTPException(status_code=503, detail="LLM provider not configured.")

    # Rate limiting check
    limiter = get_rate_limiter()
    client_id = get_client_identifier(request, request_body.metadata)
    
    # Estimate cost for rate limiting (rough estimate based on prompt length)
    # This is a conservative estimate - actual cost will be calculated after the request
    rough_cost_estimate = len(prompt) / 1000 * 0.001  # Rough $0.001 per 1K chars
    
    allowed, error_msg = limiter.check_rate_limit(
        client_id,
        request_body.kind,
        estimated_cost=rough_cost_estimate,
    )
    if not allowed:
        logger.warning(
            "Rate limit exceeded: client=%s kind=%s error=%s",
            client_id,
            request_body.kind,
            error_msg,
        )
        raise HTTPException(status_code=429, detail=error_msg or "Rate limit exceeded")

    start = time.perf_counter()
    
    # Resolve cost tier and select model using policy engine
    cost_tier = resolve_cost_tier(request_body.metadata)
    available_providers = await get_available_providers()
    # Fallback to OpenAI if no providers available
    if not available_providers:
        available_providers = ["openai"]
    model_spec = select_model_for_task(request_body.kind, cost_tier, available_providers)
    
    # Get system prompt, with mode-specific overrides
    base_system_prompt = get_system_prompt(request_body.kind)
    if request_body.mode and request_body.mode.lower() == 'trade':
        # Trading-specific system prompt
        system_prompt = (
            "You are a professional trading analyst. Provide structured trading signals with: "
            "action (buy/sell/hold), entry price, stop loss, take profit, confidence (0-100), "
            "risk/reward ratio, and rationale. Be precise with numbers and risk-aware. "
            "Always include position sizing recommendations based on portfolio risk limits."
        )
    elif request_body.mode and request_body.mode.lower() == 'games':
        # Games-specific system prompt
        system_prompt = (
            "You are a gaming recommendation assistant. Help users discover games that match "
            "their preferences based on their favorite games, recent plays, and categories. "
            "Recommend games with similar gameplay mechanics, genres, or styles. "
            "Provide clear game IDs or titles in your response for easy matching. "
            "Consider diversity - suggest a mix of categories when possible."
        )
    else:
        system_prompt = base_system_prompt
    
    # Build enhanced context from various sources (memories, agent runs, tabs, etc.)
    enhanced_context = ""
    if request_body.context:
        enhanced_context = build_enhanced_context(request_body.context)
    
    # Adjust token budget if context is large
    context_tokens = estimate_context_tokens(enhanced_context)
    base_max_tokens = model_spec.max_tokens
    # Reserve ~30% of budget for context, rest for completion
    if context_tokens > 0:
        # Increase max tokens if context is substantial
        adjusted_max = int(base_max_tokens * 1.3)  # Allow 30% more for context
        max_tokens = enforce_token_budget(
            request_body.max_tokens, 
            max(adjusted_max, base_max_tokens), 
            absolute_max=2500  # Higher cap when context is present
        )
    else:
        max_tokens = enforce_token_budget(request_body.max_tokens, model_spec.max_tokens, absolute_max=2000)
    
    temperature = request_body.temperature if request_body.temperature is not None else model_spec.temperature

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add enhanced context if available
    if enhanced_context:
        messages.append({"role": "system", "content": enhanced_context})
    
    messages.append({"role": "user", "content": prompt})

    def normalize_citations(raw_citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for idx, citation in enumerate(raw_citations):
            normalized.append(
                {
                    "index": idx + 1,
                    "title": citation.get("title") or citation.get("url") or f"Source {idx + 1}",
                    "url": citation.get("url"),
                    "snippet": citation.get("snippet"),
                    "source": citation.get("source") or citation.get("domain"),
                }
            )
        return normalized

    citations: List[Dict[str, Any]] = []
    if request_body.kind.lower() == 'search':
        try:
            search_payload = await aggregate_search(
                query=prompt,
                sources=['duckduckgo', 'bing'],
                max_results=8,
                bing_api_key=os.getenv('BING_API_KEY'),
                include_summary=False,
            )
            results: List[dict] = search_payload if isinstance(search_payload, list) else search_payload.get('results', [])
            citations = normalize_citations(results[:8])
            if citations:
                context_block = "\n\n".join(
                    f"[{idx + 1}] {cite.get('title')}\n{cite.get('url')}\n{cite.get('snippet') or ''}"
                    for idx, cite in enumerate(citations)
                )
                messages.append(
                    {
                        "role": "system",
                        "content": f"Search sources:\n{context_block}",
                    }
                )
        except Exception as exc:
            logger.warning("Search aggregation failed for ai_task: %s", exc)

    async def sse_generator():
        nonlocal start, model_spec, client_id, cost_tier, limiter, prompt, request_body
        current_spec = model_spec
        attempt = 0
        max_attempts = 3  # Try primary model, then fallback with retries
        base_delay = 0.5  # Initial delay in seconds
        
        # Check cache first (only for cacheable requests)
        if should_cache(request_body.kind, prompt):
            context_hash = hash_context(request_body.context)
            cache_key_str = cache_key(prompt, request_body.kind, current_spec.model, context_hash)
            cached_response = get_cached_response(cache_key_str, get_cache_ttl(request_body.kind))
            
            if cached_response:
                logger.info(f"Cache hit for kind={request_body.kind} model={current_spec.model}")
                # Stream cached response (simulate token-by-token streaming)
                if cached_response.get("text"):
                    text = cached_response["text"]
                    # Stream in chunks to simulate real streaming (better UX)
                    chunk_size = 10  # Characters per chunk
                    for i in range(0, len(text), chunk_size):
                        chunk = text[i:i + chunk_size]
                        yield f"data: {chunk}\n\n"
                        # Small delay for more realistic streaming (optional)
                        # await asyncio.sleep(0.01)
                
                # Return cached result
                payload = {
                    "latency_ms": 0,  # Cached, no latency
                    "provider": cached_response.get("provider", current_spec.provider),
                    "model": cached_response.get("model", current_spec.model),
                    "text": cached_response.get("text", ""),
                    "usage": cached_response.get("usage"),
                    "citations": cached_response.get("citations", citations),
                    "estimated_cost_usd": 0.0,  # Cached, no cost
                    "cached": True,
                }
                yield build_stream_payload(event_type="done", data=payload)
                return
        
        while attempt < max_attempts:
            try:
                model = current_spec.model
                max_tokens = current_spec.max_tokens
                temperature = current_spec.temperature
                
                full_text = []
                usage_info: Dict[str, Any] | None = None
                
                # Route to the correct provider based on model spec
                if current_spec.provider == "openai":
                    client = get_openai_client()
                    stream_gen = client.stream_chat(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                elif current_spec.provider == "anthropic":
                    client = get_anthropic_client()
                    stream_gen = client.stream_chat(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                elif current_spec.provider == "ollama":
                    client = get_ollama_client()
                    stream_gen = client.stream_chat(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                else:
                    # Fallback to OpenAI
                    logger.warning(f"Unknown provider {current_spec.provider}, falling back to OpenAI")
                    client = get_openai_client()
                    stream_gen = client.stream_chat(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                
                async for chunk in stream_gen:
                    if chunk.get("error"):
                        raise RuntimeError(chunk["error"])
                    if chunk.get("usage"):
                        usage_info = chunk["usage"]
                    if chunk.get("text"):
                        full_text.append(chunk["text"])
                        yield f"data: {chunk['text']}\n\n"
                
                elapsed = int((time.perf_counter() - start) * 1000)
                estimated_cost = None
                if usage_info and current_spec.estimated_cost_per_1k_tokens > 0:
                    estimated_cost = estimate_cost(
                        current_spec,
                        usage_info.get("prompt_tokens", 0),
                        usage_info.get("completion_tokens", 0),
                    )
                
                # Record successful request in rate limiter
                limiter.record_request(client_id, request_body.kind, estimated_cost)
                
                payload = {
                    "latency_ms": elapsed,
                    "provider": current_spec.provider,
                    "model": model,
                    "text": "".join(full_text),
                    "usage": usage_info,
                    "citations": citations,
                    "estimated_cost_usd": estimated_cost,
                }
                logger.info(
                    "ai_task kind=%s model=%s cost_tier=%s latency=%dms tokens=%s cost=$%.6f",
                    request_body.kind,
                    model,
                    cost_tier.value,
                    elapsed,
                    usage_info,
                    estimated_cost or 0.0,
                )
                await record_ai_task_metric(
                    {
                        "status": "success",
                        "kind": request_body.kind,
                        "mode": request_body.mode,
                        "latency_ms": elapsed,
                        "provider": payload["provider"],
                        "model": payload["model"],
                        "usage": payload["usage"],
                        "estimated_cost_usd": estimated_cost,
                        "cost_tier": cost_tier.value,
                        "prompt_chars": len(prompt),
                        "has_context": bool(request_body.context),
                        "metadata": request_body.metadata,
                        "citations_count": len(citations),
                        "client_id": client_id,
                    }
                )
                
                # Cache successful response
                if should_cache(request_body.kind, prompt):
                    context_hash = hash_context(request_body.context)
                    cache_key_str = cache_key(prompt, request_body.kind, model, context_hash)
                    cache_ttl = get_cache_ttl(request_body.kind)
                    set_cached_response(
                        cache_key_str,
                        {
                            "text": payload["text"],
                            "provider": payload["provider"],
                            "model": payload["model"],
                            "usage": payload["usage"],
                            "citations": payload["citations"],
                        },
                        cache_ttl,
                    )
                
                yield build_stream_payload(event_type="done", data=payload)
                return  # Success, exit retry loop
                
            except Exception as exc:
                attempt += 1
                error_details = extract_error_details(exc)
                retryable = error_details.get("retryable", False)
                
                logger.warning(
                    "AI task attempt %d/%d failed kind=%s model=%s provider=%s error=%s (retryable=%s)",
                    attempt,
                    max_attempts,
                    request_body.kind,
                    current_spec.model,
                    current_spec.provider,
                    exc,
                    retryable,
                    extra=error_details,
                )
                
                # If retryable and we have attempts left, retry with exponential backoff
                if retryable and attempt < max_attempts:
                    delay = min(base_delay * (2 ** (attempt - 1)), 5.0)  # Max 5 seconds
                    logger.debug(f"Retrying in {delay:.2f}s... (attempt {attempt}/{max_attempts})")
                    await asyncio.sleep(delay)
                    continue
                
                # Try fallback model if available and error is not retryable
                if not retryable and attempt < max_attempts:
                    fallback_spec = get_fallback_model(current_spec)
                    if fallback_spec:
                        logger.info(
                            "Falling back to %s:%s for kind=%s (previous error: %s)",
                            fallback_spec.provider,
                            fallback_spec.model,
                            request_body.kind,
                            type(exc).__name__,
                        )
                        current_spec = fallback_spec
                        continue
                
                # No fallback or max attempts reached - format user-friendly error
                user_friendly_message = format_user_friendly_error(exc)
                error_summary = {
                    "message": user_friendly_message,
                    "type": error_details.get("type", type(exc).__name__),
                    "retryable": retryable,
                    "provider": current_spec.provider,
                    "model": current_spec.model,
                }
                
                await record_ai_task_metric(
                    {
                        "status": "error",
                        "kind": request_body.kind,
                        "mode": request_body.mode,
                        "provider": current_spec.provider,
                        "model": current_spec.model,
                        "latency_ms": int((time.perf_counter() - start) * 1000),
                        "prompt_chars": len(prompt),
                        "has_context": bool(request_body.context),
                        "metadata": request_body.metadata,
                        "error": str(exc),
                        "error_type": error_details.get("type"),
                        "retryable": retryable,
                        "client_id": client_id,
                    }
                )
                yield build_stream_payload(event_type="error", data=error_summary)
                return

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

