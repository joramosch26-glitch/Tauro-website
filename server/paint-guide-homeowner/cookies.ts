import { parseHomeownerSessionBearer } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";

export const HOMEOWNER_SESSION_COOKIE_NAME = "tauro_paint_guide_session";
export const HOMEOWNER_SESSION_COOKIE_PATH = "/api/paint-guide/homeowner";
export const HOMEOWNER_SESSION_MAX_AGE_SECONDS = 1740;

function cookieAttributes(environment: HomeownerServerEnvironment) {
  const attributes = [
    "HttpOnly",
    "SameSite=Strict",
    `Path=${HOMEOWNER_SESSION_COOKIE_PATH}`,
  ];
  if (environment.environment === "production") attributes.push("Secure");
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
