"""In-process sliding-window rate limiter for authentication endpoints.

Each key (typically ``"<scope>:<client-ip>"``) keeps a deque of attempt
timestamps. An attempt is allowed while fewer than ``max_attempts`` events
remain inside the window.

This is deliberately dependency-free and deterministic. It protects a single
backend process; a shared store (for example Redis) would be required to rate
limit across multiple instances, which is documented as a limitation in
``docs/SECURITY.md``.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable


class SlidingWindowRateLimiter:
    """Thread-safe fixed-capacity sliding-window limiter."""

    def __init__(
        self,
        max_attempts: int,
        window_seconds: float,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_attempts = max(1, int(max_attempts))
        self._window_seconds = max(0.001, float(window_seconds))
        self._clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Record an attempt for ``key`` and return ``(allowed, retry_after)``.

        ``retry_after`` is the number of seconds until the next attempt is
        permitted; it is 0 when the attempt is allowed.
        """
        now = self._clock()
        with self._lock:
            events = self._events[key]
            cutoff = now - self._window_seconds
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= self._max_attempts:
                oldest = events[0]
                retry_after = int(self._window_seconds - (now - oldest)) + 1
                return False, max(1, retry_after)

            events.append(now)
            return True, 0

    def reset(self, key: str | None = None) -> None:
        """Forget attempts for ``key`` (or everything when ``key`` is None)."""
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)
