"""
Anthropic Client for FastAPI Backend
Provides Claude API capabilities
"""

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Optional, List

import httpx

logger = logging.getLogger(__name__)


class AnthropicClient:
    """Client for Anthropic API (Claude)"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.anthropic.com/v1",
    ):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None
        self.timeout = 60.0

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None:
            headers = {
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            }
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                limits=httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=20,
                    keepalive_expiry=30.0,
                ),
                http2=True,  # Use HTTP/2 for better performance
            )
        return self._client

    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def check_available(self) -> bool:
        """Check if Anthropic API is available"""
        if not self.api_key:
            return False
        try:
            # Just check if we have a key (no public endpoint to check)
            return bool(self.api_key)
        except Exception as e:
            logger.debug(f"Anthropic check failed: {e}")
            return bool(self.api_key)

    async def stream_chat(
        self,
        messages: List[dict[str, str]],
        model: str = "claude-3-haiku-20240307",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[dict, None]:
        """
        Stream chat completion from Anthropic API
        
        Yields:
            dict with keys: 'text' (str), 'done' (bool), 'error' (Optional[str]), 'usage' (Optional[dict])
        """
        if not self.api_key:
            yield {"text": "", "done": True, "error": "Anthropic API key not configured"}
            return

        try:
            client = await self._get_client()
            
            # Anthropic expects system and messages format
            system_message = None
            anthropic_messages = []
            
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "system":
                    system_message = content
                else:
                    # Map roles: user -> user, assistant -> assistant
                    anthropic_role = "user" if role == "user" else "assistant"
                    anthropic_messages.append({
                        "role": anthropic_role,
                        "content": content,
                    })
            
            request_body = {
                "model": model,
                "messages": anthropic_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }
            
            if system_message:
                request_body["system"] = system_message
            
            async with client.stream(
                "POST",
                f"{self.base_url}/messages",
                json=request_body,
                timeout=60.0,
            ) as response:
                if not response.is_success:
                    error_text = await response.aread()
                    error_msg = error_text.decode() if error_text else str(response.status_code)
                    try:
                        error_json = json.loads(error_msg)
                        if "error" in error_json:
                            error_msg = error_json["error"].get("message", str(error_json["error"]))
                    except:
                        pass
                    yield {"text": "", "done": True, "error": f"Anthropic error: {error_msg}"}
                    return

                buffer = ""
                usage_info: Optional[dict] = None
                
                async for chunk in response.aiter_text():
                    buffer += chunk
                    lines = buffer.split("\n")
                    buffer = lines.pop() if lines else ""

                    for line in lines:
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue

                        # Remove "data: " prefix
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            yield {"text": "", "done": True, "error": None, "usage": usage_info}
                            return

                        try:
                            data = json.loads(data_str)
                            
                            # Extract delta content
                            if data.get("type") == "content_block_delta":
                                delta = data.get("delta", {})
                                if "text" in delta:
                                    text = delta["text"]
                                    yield {"text": text, "done": False, "error": None}
                            
                            # Extract usage info
                            if data.get("type") == "message_stop":
                                # Usage is in the stop event
                                usage_info = data.get("usage")
                            
                            # Check if finished
                            if data.get("type") == "message_stop":
                                yield {"text": "", "done": True, "error": None, "usage": usage_info}
                                return
                        except json.JSONDecodeError:
                            continue

                yield {"text": "", "done": True, "error": None, "usage": usage_info}

        except httpx.TimeoutException:
            logger.error("Anthropic chat request timed out")
            yield {"text": "", "done": True, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Anthropic streaming error: {e}")
            yield {"text": "", "done": True, "error": str(e)}


# Global singleton instance
_anthropic_client: Optional[AnthropicClient] = None


def get_anthropic_client(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> AnthropicClient:
    """Get or create Anthropic client singleton"""
    global _anthropic_client
    if _anthropic_client is None:
        key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        url = base_url or os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
        _anthropic_client = AnthropicClient(api_key=key, base_url=url)
    return _anthropic_client

