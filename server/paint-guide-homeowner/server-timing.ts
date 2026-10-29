/** Adds a bounded, identifier-free handler duration to synthetic Preview responses only. */
export function addHomeownerPreviewTiming(
  response: Response,
  startedAtMs: number,
  finishedAtMs: number,
  enabled = process.env.TAURO_PG_ENVIRONMENT === "preview"
    && process.env.TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED === "true",
) {
  if (!enabled) return response;
  const duration = Number.isFinite(startedAtMs) && Number.isFinite(finishedAtMs)
    ? Math.max(0, Math.min(60_000, finishedAtMs - startedAtMs))
    : 0;
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `handler;dur=${duration.toFixed(1)}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createHomeownerPreviewTimedHandler(
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request) => {
    const startedAt = performance.now();
    const response = await handler(request);
    return addHomeownerPreviewTiming(response, startedAt, performance.now());
  };
}
