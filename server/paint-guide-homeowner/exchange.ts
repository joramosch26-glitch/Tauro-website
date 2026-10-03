import { deriveLookupHmac, parseHomeownerAccessToken } from "./crypto.js";
import { clearHomeownerSessionCookie, serializeHomeownerSessionCookie } from "./cookies.js";
import { loadHomeownerServerEnvironment } from "./env.js";
import { hasAllowedHomeownerOrigin } from "./origin.js";
import { homeownerNoContentResponse, homeownerUnavailableResponse } from "./responses.js";
import { exchangeHomeownerSession, type HomeownerSessionExchangeInput, type HomeownerSessionExchangeResult } from "./rpc.js";
import { createHomeownerSessionBearer, deriveSessionHmac } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";

const MAX_EXCHANGE_REQUEST_BYTES = 1024;
const MAX_ACCESS_BEARER_LENGTH = 128;
export const HOMEOWNER_SESSION_TTL_SECONDS = 1740;

type HomeownerExchangeDependencies = {
  loadEnvironment?: () => HomeownerServerEnvironment;
  exchangeSession?: (
    environment: HomeownerServerEnvironment,
    input: HomeownerSessionExchangeInput,
  ) => Promise<HomeownerSessionExchangeResult>;
  now?: () => Date;
};

function hasJsonContentType(request: Request) {
  return request.headers.get("content-type") === "application/json";
}

function requestLengthIsAllowed(request: Request) {
  const length = request.headers.get("content-length");
  if (length === null) return true;
  if (!/^[0-9]+$/.test(length)) return false;
  const parsed = Number(length);
  return Number.isSafeInteger(parsed) && parsed <= MAX_EXCHANGE_REQUEST_BYTES;
}

async function parseExchangeToken(request: Request) {
  if (!hasJsonContentType(request) || !requestLengthIsAllowed(request)) return null;

  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_EXCHANGE_REQUEST_BYTES) return null;
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return null;
  }

  const values = body as Record<string, unknown>;
  if (Object.keys(values).length !== 1 || typeof values.token !== "string") return null;
  if (values.token.length > MAX_ACCESS_BEARER_LENGTH) return null;
  return values.token;
}

function unavailableWithClearedSession(environment: HomeownerServerEnvironment) {
  return homeownerUnavailableResponse({
    headers: { "Set-Cookie": clearHomeownerSessionCookie(environment) },
  });
}

export function createHomeownerExchangeHandler(
  dependencies: HomeownerExchangeDependencies = {},
) {
  const getEnvironment = dependencies.loadEnvironment ?? loadHomeownerServerEnvironment;
  const exchangeSession = dependencies.exchangeSession ?? exchangeHomeownerSession;
  const now = dependencies.now ?? (() => new Date());

  return async function handleExchange(request: Request) {
    if (request.method !== "POST") return homeownerUnavailableResponse();

    let environment: HomeownerServerEnvironment;
    try {
      environment = getEnvironment();
    } catch {
      return homeownerUnavailableResponse();
    }

    if (!hasAllowedHomeownerOrigin(request, environment)) {
      return homeownerUnavailableResponse();
    }

    try {
      const rawToken = await parseExchangeToken(request);
      if (rawToken === null) return unavailableWithClearedSession(environment);

      const token = parseHomeownerAccessToken(rawToken);
      const tokenHmac = deriveLookupHmac(
        token,
        environment.expectedProjectRef,
        environment.tokenLookupHmacKeys,
      );
      const session = createHomeownerSessionBearer(environment.sessionHmacKeys.activeVersion);
      const sessionHmac = deriveSessionHmac(
        session,
        environment.expectedProjectRef,
        environment.sessionHmacKeys,
      );
      const issuedAt = now();
      if (!Number.isFinite(issuedAt.getTime())) return unavailableWithClearedSession(environment);
      const expiresAt = new Date(issuedAt.getTime() + HOMEOWNER_SESSION_TTL_SECONDS * 1000);
      const outcome = await exchangeSession(environment, {
        lookupKeyVersion: token.lookupKeyVersion,
        tokenHmac,
        sessionKeyVersion: session.sessionKeyVersion,
        sessionHmac,
        expiresAt,
      });

      if (outcome.kind !== "exchanged") return unavailableWithClearedSession(environment);

      return homeownerNoContentResponse({
        headers: { "Set-Cookie": serializeHomeownerSessionCookie(session.canonical, environment) },
      });
    } catch {
      return unavailableWithClearedSession(environment);
    }
  };
}
