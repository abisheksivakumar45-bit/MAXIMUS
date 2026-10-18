"""CSRF protection using the double-submit cookie pattern.

A random token is stored in a readable (non-HttpOnly) cookie. Every
state-changing request (POST/PUT/PATCH/DELETE) must echo the same value in the
configured header. A cross-site attacker cannot read the cookie (same-origin
policy) and cannot set a custom header on a simple form submission, so forged
requests are rejected. Combined with ``SameSite`` session cookies this gives
defence in depth.

The cookie is (re)issued on any response when it is missing, so a client only
needs to make one safe request before it can perform state-changing ones.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.security import constant_time_compare, generate_csrf_token

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


class CsrfMiddleware(BaseHTTPMiddleware):
    """Reject state-changing requests that lack a valid CSRF token."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        cookie_name: str,
        header_name: str,
        secure: bool,
        samesite: str,
        max_age: int,
    ) -> None:
        super().__init__(app)
        self._cookie_name = cookie_name
        self._header_name = header_name
        self._secure = secure
        self._samesite = samesite
        self._max_age = max_age

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        cookie_value = request.cookies.get(self._cookie_name)

        if request.method not in _SAFE_METHODS:
            header_value = request.headers.get(self._header_name)
            if (
                not cookie_value
                or not header_value
                or not constant_time_compare(cookie_value, header_value)
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF validation failed"},
                )

        response = await call_next(request)

        if not cookie_value:
            response.set_cookie(
                self._cookie_name,
                generate_csrf_token(),
                max_age=self._max_age,
                httponly=False,
                secure=self._secure,
                samesite=self._samesite,
                path="/",
            )

        return response
