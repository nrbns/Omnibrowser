"""
Ollama Client for FastAPI Backend
Provides local LLM capabilities via Ollama
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Optional, List

import httpx

logger = logging.getLogger(__name__)


class OllamaClient:
    """Client for Ollama API (local LLMs)"""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
    ):
        self.base_url = base_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None
        self.timeout = 120.0  # Longer timeout for local models

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            headers = {
                "Content-Type": "application/json",
            }
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(
                    max_keepalive_connections=5,
                    max_connections=10,
                    keepalive_expiry=60.0,  # Longer for local connections
                ),
                # Don't use HTTP/2 for local connections
            )
        return self._client

    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def check_available(self) -> bool:
        """Check if Ollama API is available"""
        try:
            client = await self._get_client()
            # Try to list models or just ping the API
            response = await client.get(
                f"{self.base_url}/api/tags",
                timeout=5.0,
            )
            return response.is_success
        except Exception as e:
            logger.debug(f"Ollama check failed: {e}")
            return False

    async def stream_chat(
        self,
        messages: List[dict[str, str]],
        model: str = "llama2",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream chat completion from Ollama API
        
        Yields:
            dict with keys: 'text' (str), 'done' (bool), 'error' (Optional[str]), 'usage' (Optional[dict])
        """
        try:
            client = await self._get_client()
            
            # Ollama expects messages in a specific format
            # Combine system messages into the prompt
            system_parts = []
            user_parts = []
            
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "system":
                    system_parts.append(content)
                elif role == "user":
                    user_parts.append(content)
                elif role == "assistant":
                    # Ollama doesn't support multi-turn easily, just append to prompt
                    pass
            
            # Build prompt: system + user messages
            prompt_parts = []
            if system_parts:
                prompt_parts.append("System:\n" + "\n".join(system_parts))
            if user_parts:
                prompt_parts.append("User:\n" + "\n".join(user_parts))
            
            prompt = "\n\n".join(prompt_parts)
            
            request_body = {
                "model": model,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,  # Ollama uses num_predict instead of max_tokens
                },
            }
            
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=request_body,
                timeout=self.timeout,
            ) as response:
                if not response.is_success:
                    error_text = await response.aread()
                    error_msg = error_text.decode() if error_text else str(response.status_code)
                    try:
                        error_json = json.loads(error_msg)
                        if "error" in error_json:
                            error_msg = error_json["error"]
                    except:
                        pass
                    yield {"text": "", "done": True, "error": f"Ollama error: {error_msg}"}
                    return

                usage_info: Optional[dict] = None
                prompt_tokens = 0
                completion_tokens = 0
                
                async for chunk in response.aiter_text():
                    if not chunk.strip():
                        continue
                    
                    lines = chunk.strip().split("\n")
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue

                        try:
                            data = json.loads(line)
                            
                            # Extract text delta
                            if "response" in data:
                                text = data["response"]
                                yield {"text": text, "done": False, "error": None}
                            
                            # Extract usage info
                            if "prompt_eval_count" in data:
                                prompt_tokens = data.get("prompt_eval_count", 0)
                            if "eval_count" in data:
                                completion_tokens = data.get("eval_count", 0)
                            
                            # Check if done
                            if data.get("done", False):
                                usage_info = {
                                    "prompt_tokens": prompt_tokens,
                                    "completion_tokens": completion_tokens,
                                    "total_tokens": prompt_tokens + completion_tokens,
                                }
                                yield {"text": "", "done": True, "error": None, "usage": usage_info}
                                return
                        except json.JSONDecodeError:
                            continue

                # If we exit without done, construct usage from last known values
                if usage_info is None:
                    usage_info = {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": prompt_tokens + completion_tokens,
                    }
                yield {"text": "", "done": True, "error": None, "usage": usage_info}

        except httpx.TimeoutException:
            logger.error("Ollama chat request timed out")
            yield {"text": "", "done": True, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Ollama streaming error: {e}")
            yield {"text": "", "done": True, "error": str(e)}


# Global singleton instance
_ollama_client: Optional[OllamaClient] = None


def get_ollama_client(
    base_url: Optional[str] = None,
) -> OllamaClient:
    """Get or create Ollama client singleton"""
    global _ollama_client
    if _ollama_client is None:
        url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        _ollama_client = OllamaClient(base_url=url)
    return _ollama_client
