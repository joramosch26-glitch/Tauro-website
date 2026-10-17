import { parseHomeownerSessionBearer } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";

export const HOMEOWNER_SESSION_COOKIE_NAME = "tauro_paint_guide_session";
export const HOMEOWNER_SESSION_COOKIE_PATH = "/api/paint-guide/homeowner";
export const HOMEOWNER_SESSION_MAX_AGE_SECONDS = 1740;

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_VALUE = /^[!#$%&'()*+\-./:<=>?@\[\]^_`{|}~0-9A-Za-z]*$/;

function cookieAttributes(environment: HomeownerServerEnvironment) {
  const attributes = [
    "HttpOnly",
    "SameSite=Strict",
    `Path=${HOMEOWNER_SESSION_COOKIE_PATH}`,
  ];
  // Configuration is validated before use; never trust Host/forwarded headers.
  if (environment.environment === "production"
    || [...environment.allowedOrigins].every((origin) => new URL(origin).protocol === "https:")) {
    attributes.push("Secure");
  }
  return attributes;
}

export function serializeHomeownerSessionCookie(
  bearer: string,
  environment: HomeownerServerEnvironment,
) {
  const parsed = parseHomeownerSessionBearer(bearer);
  if (parsed.canonical !== bearer) throw new Error("Invalid homeowner session cookie.");

  return [
    `${HOMEOWNER_SESSION_COOKIE_NAME}=${bearer}`,
    `Max-Age=${HOMEOWNER_SESSION_MAX_AGE_SECONDS}`,
    ...cookieAttributes(environment),
  ].join("; ");
}

export function clearHomeownerSessionCookie(environment: HomeownerServerEnvironment) {
  return [
    `${HOMEOWNER_SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...cookieAttributes(environment),
  ].join("; ");
}

/** Reads exactly one candidate without decoding or normalizing its value. */
export function readHomeownerSessionCookie(request: Request) {
  const header = request.headers.get("cookie");
  if (header === null || header === "") return null;

  let sessionBearer: string | null = null;
  for (const rawPart of header.split(";")) {
    const part = rawPart.startsWith(" ") ? rawPart.slice(1) : rawPart;
    const separator = part.indexOf("=");
    if (separator < 1) return null;

    const name = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (!COOKIE_NAME.test(name) || !COOKIE_VALUE.test(value)) return null;
    if (name === HOMEOWNER_SESSION_COOKIE_NAME) {
      if (sessionBearer !== null) return null;
      sessionBearer = value;
    }
  }
  return sessionBearer;
}
