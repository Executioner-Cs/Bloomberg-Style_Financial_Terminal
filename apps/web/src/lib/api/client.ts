/**
 * Typed fetch wrapper for the terminal REST API.
 *
 * Uses a relative base path so the Vite dev-server proxy forwards requests to
 * the FastAPI backend (VITE_DEV_API_PROXY_TARGET), and Nginx serves in
 * production — no hard-coded host required in client code.
 */

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
 * @param params - Optional URL query parameters
 * @throws {ApiError} on non-2xx responses
 */
export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.statusText,
      `API request failed: ${response.status} ${response.statusText} — ${path}`,
    );
  }

  return response.json() as Promise<T>;
}
