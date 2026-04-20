/**
 * Typed fetch wrapper for the terminal REST API.
 *
 * Uses a relative base path so the Vite dev-server proxy forwards requests to
 * the FastAPI backend (VITE_DEV_API_PROXY_TARGET), and Nginx serves in
 * production — no hard-coded host required in client code.
 */

/**
 * Client-side timeout for all API requests.
 *
 * Reads VITE_API_TIMEOUT_MS from the build-time env; falls back to 30 000 ms
 * to match the API server's self-imposed ceiling for external provider calls
 * (ADR-005). Browser fetch does not enforce timeouts natively — AbortController
 * is required to prevent hung requests from blocking the UI.
 */
const API_REQUEST_TIMEOUT_MS: number =
  typeof import.meta.env['VITE_API_TIMEOUT_MS'] === 'string'
    ? Number(import.meta.env['VITE_API_TIMEOUT_MS'])
    : 30_000;

/** Structured error thrown by apiGet when the server returns a non-2xx status. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Perform a typed GET request against the terminal API.
 *
 * @param path   - Full path including prefix, e.g. `${API_V1_PREFIX}/instruments`
 * @param params - Optional query parameters. String values are appended once;
 *                 string arrays are appended per-element (e.g. for FastAPI `list[str]` params).
 * @throws {ApiError} on non-2xx responses
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | string[]>,
): Promise<T> {
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) searchParams.append(key, v);
      } else {
        searchParams.append(key, value);
      }
    }
    url = `${path}?${searchParams.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.statusText,
      `API request failed: ${response.status} ${response.statusText} — ${path}`,
    );
  }

  return response.json() as Promise<T>;
}
