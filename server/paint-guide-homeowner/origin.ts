import type { PaintGuideServerEnvironment } from "./types.js";

function parseExactOrigin(value: string) {
  try {
    const origin = new URL(value);
    if (origin.origin !== value) return null;
    return origin.origin;
  } catch {
    return null;
  }
}

export function hasAllowedHomeownerOrigin(
  request: Request,
  environment: PaintGuideServerEnvironment,
) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const parsedOrigin = parseExactOrigin(origin);
  return parsedOrigin !== null && environment.allowedOrigins.has(parsedOrigin);
}
