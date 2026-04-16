/**
 * Minimal `fetch` wrapper with a hard timeout.
 *
 * **Why this exists:** Vercel Functions have execution time limits (default
 * 300s, but our route handlers fan out to ~10 external APIs in parallel). A
 * single hung upstream call can starve the whole request, returning 504 to
 * the user. AbortController gives us bounded execution per call.
 *
 * Usage:
 *   const res = await fetchWithTimeout(url, { ...init, timeoutMs: 10_000 });
 *
 * Behavior:
 *   - On timeout: aborts the underlying fetch, throws `Error('fetch timeout
 *     after Nms: <url>')`. Callers should already be wrapped in try/catch.
 *   - All other Response semantics are unchanged — caller still inspects
 *     `res.ok`, `res.status`, etc.
 *   - Forwards Next.js fetch `next: { revalidate, tags }` config untouched.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] }; timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, signal: callerSignal, ...rest } = init;

  const controller = new AbortController();
  // If the caller passed their own signal, abort on either trigger.
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      const url = typeof input === 'string' ? input : input.toString();
      throw new Error(`fetch timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
