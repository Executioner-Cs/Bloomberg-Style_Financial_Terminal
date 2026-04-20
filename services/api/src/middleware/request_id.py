"""
Request ID middleware — injects a UUID per request for distributed tracing.

Why: Every response includes X-Request-ID so that generic API error messages
("something went wrong") can be correlated to detailed server logs.
Users can report this ID to support without exposing internal details.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Inject a unique X-Request-ID header into every request and response."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
