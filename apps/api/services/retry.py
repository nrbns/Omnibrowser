"""
Retry Utilities - Exponential backoff and error handling
"""

from __future__ import annotations

import asyncio
import logging
from functools import wraps
from typing import Callable, TypeVar, Optional, List, Tuple

logger = logging.getLogger(__name__)

T = TypeVar("T")


class RetryableError(Exception):
    """Error that can be retried"""
    pass


class NonRetryableError(Exception):
    """Error that should not be retried"""
    pass


async def retry_with_backoff(
    func: Callable[..., T],
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    exponential_base: float = 2.0,
    retryable_errors: Optional[List[type]] = None,
    *args,
    **kwargs,
) -> T:
    """
    Retry a function with exponential backoff.
    
    Args:
        func: Async function to retry
        max_attempts: Maximum number of attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        retryable_errors: List of exception types that should be retried
        *args, **kwargs: Arguments to pass to func
    
    Returns:
        Result of func
    
    Raises:
        Last exception if all attempts fail
    """
    if retryable_errors is None:
        retryable_errors = [Exception]
    
    last_exception: Optional[Exception] = None
    
    for attempt in range(1, max_attempts + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except tuple(retryable_errors) as exc:
            last_exception = exc
            
            # Don't retry on last attempt
            if attempt >= max_attempts:
                logger.warning(
                    f"Retry failed after {attempt} attempts: {exc}",
                    exc_info=exc,
                )
                raise
            
            # Calculate delay with exponential backoff
            delay = min(
                initial_delay * (exponential_base ** (attempt - 1)),
                max_delay,
            )
            
            logger.debug(
                f"Retry attempt {attempt}/{max_attempts} failed: {exc}. "
                f"Retrying in {delay:.2f}s..."
            )
            
            await asyncio.sleep(delay)
        except Exception as exc:
            # Non-retryable error
            logger.error(f"Non-retryable error: {exc}", exc_info=exc)
            raise
    
    # Should never reach here, but just in case
    if last_exception:
        raise last_exception
    raise RuntimeError("Retry failed for unknown reason")


def is_retryable_error(error: Exception) -> bool:
    """
    Determine if an error should be retried.
    
    Args:
        error: Exception to check
    
    Returns:
        True if error should be retried, False otherwise
    """
    # Network errors (timeouts, connection errors)
    error_str = str(error).lower()
    retryable_keywords = [
        "timeout",
        "connection",
        "network",
        "temporary",
        "rate limit",
        "429",
        "502",
        "503",
        "504",
        "service unavailable",
        "too many requests",
    ]
    
    if any(keyword in error_str for keyword in retryable_keywords):
        return True
    
    # Check error type
    if isinstance(error, RetryableError):
        return True
    if isinstance(error, NonRetryableError):
        return False
    
    # Retry on specific HTTP status codes
    if hasattr(error, "status_code"):
        status = getattr(error, "status_code")
        if status in [429, 502, 503, 504]:
            return True
        if status >= 500:  # Server errors
            return True
        if status < 500:  # Client errors (except rate limits)
            return False
    
    # Default: don't retry unknown errors
    return False


def format_user_friendly_error(error: Exception) -> str:
    """
    Format an error message to be user-friendly.
    
    Args:
        error: Exception to format
    
    Returns:
        User-friendly error message
    """
    error_msg = str(error)
    error_type = type(error).__name__
    
    # Common error patterns
    if "api key" in error_msg.lower() or "authentication" in error_msg.lower():
        return "API authentication failed. Please check your API key configuration."
    
    if "timeout" in error_msg.lower():
        return "Request timed out. The service may be slow or unavailable. Please try again."
    
    if "rate limit" in error_msg.lower() or "429" in error_msg:
        return "Rate limit exceeded. Please wait a moment and try again."
    
    if "connection" in error_msg.lower() or "network" in error_msg.lower():
        return "Network error. Please check your internet connection and try again."
    
    if "service unavailable" in error_msg.lower() or "503" in error_msg:
        return "Service temporarily unavailable. Please try again in a few moments."
    
    if "quota" in error_msg.lower() or "limit" in error_msg.lower():
        return "Usage limit reached. Please check your account limits or upgrade your plan."
    
    # Provider-specific errors
    if "openai" in error_type.lower() or "openai" in error_msg.lower():
        if "insufficient_quota" in error_msg.lower():
            return "OpenAI quota exceeded. Please check your billing and credits."
        return "OpenAI service error. Please try again or contact support."
    
    if "anthropic" in error_type.lower() or "anthropic" in error_msg.lower():
        return "Claude service error. Please try again or contact support."
    
    if "ollama" in error_type.lower() or "ollama" in error_msg.lower():
        if "connection refused" in error_msg.lower():
            return "Ollama service not running. Please start Ollama locally or use a cloud provider."
        return "Local LLM service error. Please check Ollama installation."
    
    # Generic fallback
    if error_msg:
        # Extract first sentence if message is long
        if len(error_msg) > 200:
            first_sentence = error_msg.split(". ")[0]
            return f"{first_sentence}. Please try again."
        return error_msg
    
    return "An unexpected error occurred. Please try again."


def extract_error_details(error: Exception) -> dict:
    """
    Extract structured error details for logging.
    
    Args:
        error: Exception to extract details from
    
    Returns:
        Dictionary with error details
    """
    details = {
        "type": type(error).__name__,
        "message": str(error),
        "retryable": is_retryable_error(error),
    }
    
    # Add HTTP status code if available
    if hasattr(error, "status_code"):
        details["status_code"] = getattr(error, "status_code")
    
    # Add response body if available
    if hasattr(error, "response"):
        response = getattr(error, "response")
        if hasattr(response, "text"):
            try:
                details["response_body"] = response.text[:500]  # Limit length
            except:
                pass
    
    return details

