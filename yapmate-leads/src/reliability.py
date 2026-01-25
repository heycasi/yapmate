"""
Reliability Layer for YapMate Leads Pipeline.

Provides:
- Retry logic with exponential backoff
- Circuit breakers
- Graceful degradation
- Structured error handling
"""

import time
import functools
from typing import TypeVar, Callable, Optional, Any, Dict
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta

from src.config import get_config


class ErrorType(Enum):
    """Classified error types for observability."""
    CONFIG_ERROR = "CONFIG_ERROR"
    API_ERROR = "API_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    AUTH_ERROR = "AUTH_ERROR"
    DATA_ERROR = "DATA_ERROR"
    RATE_LIMIT = "RATE_LIMIT"
    TIMEOUT = "TIMEOUT"
    UNKNOWN = "UNKNOWN"


@dataclass
class PipelineError:
    """Structured error for pipeline operations."""
    error_type: ErrorType
    message: str
    service: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    recoverable: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type.value,
            "message": self.message,
            "service": self.service,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
            "recoverable": self.recoverable,
        }

    def log(self) -> None:
        icon = "⚠️" if self.recoverable else "❌"
        print(f"[ERROR] {icon} [{self.error_type.value}] {self.service}: {self.message}")


class CircuitBreaker:
    """
    Circuit breaker pattern implementation.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failures exceeded threshold, requests blocked
    - HALF_OPEN: Testing if service recovered
    """

    def __init__(self, name: str, failure_threshold: int = 5, reset_timeout: int = 60):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"

    def record_failure(self) -> None:
        """Record a failure and potentially open the circuit."""
        self.failures += 1
        self.last_failure_time = datetime.utcnow()

        if self.failures >= self.failure_threshold:
            self.state = "OPEN"
            print(f"[CIRCUIT] {self.name}: OPENED (failures={self.failures})")

    def record_success(self) -> None:
        """Record a success and reset the circuit."""
        self.failures = 0
        self.state = "CLOSED"

    def is_open(self) -> bool:
        """Check if circuit is open (blocking requests)."""
        if self.state == "CLOSED":
            return False

        if self.state == "OPEN":
            # Check if reset timeout has passed
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                if elapsed >= self.reset_timeout:
                    self.state = "HALF_OPEN"
                    print(f"[CIRCUIT] {self.name}: HALF_OPEN (testing recovery)")
                    return False
            return True

        # HALF_OPEN state - allow one request through
        return False

    def reset(self) -> None:
        """Force reset the circuit breaker."""
        self.failures = 0
        self.state = "CLOSED"
        self.last_failure_time = None


# Global circuit breakers
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a service."""
    config = get_config()

    if name not in _circuit_breakers:
        threshold = {
            "openai": config.retry.openai_failure_threshold,
            "sheets": config.retry.sheets_failure_threshold,
            "apify": config.retry.apify_failure_threshold,
        }.get(name, 5)

        _circuit_breakers[name] = CircuitBreaker(name, failure_threshold=threshold)

    return _circuit_breakers[name]


T = TypeVar("T")


def with_retry(
    service: str,
    max_retries: Optional[int] = None,
    backoff_base: float = 1.0,
    backoff_max: float = 60.0,
    retryable_exceptions: tuple = (Exception,),
) -> Callable:
    """
    Decorator for retry logic with exponential backoff.

    Args:
        service: Service name for logging and circuit breaker
        max_retries: Maximum retry attempts (default from config)
        backoff_base: Initial backoff in seconds
        backoff_max: Maximum backoff in seconds
        retryable_exceptions: Tuple of exceptions to retry on
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            config = get_config()

            # Get max retries from config if not specified
            retries = max_retries
            if retries is None:
                retries = {
                    "openai": config.retry.openai_max_retries,
                    "sheets": config.retry.sheets_max_retries,
                    "apify": config.retry.apify_max_retries,
                    "http": config.retry.http_max_retries,
                }.get(service, 3)

            # Check circuit breaker
            circuit = get_circuit_breaker(service)
            if circuit.is_open():
                raise PipelineError(
                    error_type=ErrorType.API_ERROR,
                    message=f"Circuit breaker open for {service}",
                    service=service,
                    recoverable=False,
                )

            last_exception = None
            for attempt in range(retries + 1):
                try:
                    result = func(*args, **kwargs)
                    circuit.record_success()
                    return result
                except retryable_exceptions as e:
                    last_exception = e
                    circuit.record_failure()

                    if attempt < retries:
                        # Calculate backoff with jitter
                        backoff = min(backoff_base * (2 ** attempt), backoff_max)
                        print(f"[RETRY] {service}: attempt {attempt + 1}/{retries + 1} "
                              f"failed, retrying in {backoff:.1f}s - {str(e)[:100]}")
                        time.sleep(backoff)
                    else:
                        print(f"[RETRY] {service}: all {retries + 1} attempts failed")

            # All retries exhausted
            raise last_exception

        return wrapper
    return decorator


def classify_error(exception: Exception, service: str) -> PipelineError:
    """Classify an exception into a structured PipelineError."""
    error_str = str(exception).lower()

    # Rate limiting
    if "rate" in error_str or "429" in error_str or "too many" in error_str:
        return PipelineError(
            error_type=ErrorType.RATE_LIMIT,
            message=str(exception),
            service=service,
            recoverable=True,
        )

    # Authentication
    if "auth" in error_str or "401" in error_str or "403" in error_str or "key" in error_str:
        return PipelineError(
            error_type=ErrorType.AUTH_ERROR,
            message=str(exception),
            service=service,
            recoverable=False,
        )

    # Network
    if "timeout" in error_str or "connect" in error_str or "network" in error_str:
        return PipelineError(
            error_type=ErrorType.NETWORK_ERROR,
            message=str(exception),
            service=service,
            recoverable=True,
        )

    # Timeout
    if "timeout" in error_str or "timed out" in error_str:
        return PipelineError(
            error_type=ErrorType.TIMEOUT,
            message=str(exception),
            service=service,
            recoverable=True,
        )

    # Default
    return PipelineError(
        error_type=ErrorType.UNKNOWN,
        message=str(exception),
        service=service,
        recoverable=True,
    )


@dataclass
class StageResult:
    """Result from a pipeline stage."""
    stage: str
    success: bool
    data: Any = None
    error: Optional[PipelineError] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage": self.stage,
            "success": self.success,
            "error": self.error.to_dict() if self.error else None,
            "metrics": self.metrics,
            "duration_ms": self.duration_ms,
        }


def safe_execute(
    stage: str,
    func: Callable[..., T],
    *args,
    default: T = None,
    **kwargs
) -> StageResult:
    """
    Safely execute a function and return a StageResult.
    Never raises exceptions - always returns a result.
    """
    start_time = time.time()

    try:
        result = func(*args, **kwargs)
        duration_ms = int((time.time() - start_time) * 1000)

        return StageResult(
            stage=stage,
            success=True,
            data=result,
            duration_ms=duration_ms,
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        error = classify_error(e, stage)
        error.log()

        return StageResult(
            stage=stage,
            success=False,
            data=default,
            error=error,
            duration_ms=duration_ms,
        )
