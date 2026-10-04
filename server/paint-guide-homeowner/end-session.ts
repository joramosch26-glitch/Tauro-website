import { clearHomeownerSessionCookie, readHomeownerSessionCookie } from "./cookies.js";
import { loadHomeownerServerEnvironment } from "./env.js";
import { hasAllowedHomeownerOrigin } from "./origin.js";
import {
  homeownerJsonResponse,
  homeownerNoContentResponse,
  homeownerUnavailableResponse,
} from "./responses.js";
import {
  endHomeownerSession,
  type HomeownerSessionEndInput,
  type HomeownerSessionEndResult,
} from "./rpc.js";
import { deriveSessionHmac, parseHomeownerSessionBearer } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";

type HomeownerEndSessionDependencies = {
  loadEnvironment?: () => HomeownerServerEnvironment;
  endSession?: (
    environment: HomeownerServerEnvironment,
    input: HomeownerSessionEndInput,
  ) => Promise<HomeownerSessionEndResult>;
};

function clearedNoContent(environment: HomeownerServerEnvironment) {
  return homeownerNoContentResponse({
    headers: { "Set-Cookie": clearHomeownerSessionCookie(environment) },
  });
}

function operationalFailure(environment: HomeownerServerEnvironment) {
  return homeownerJsonResponse(
    { available: false },
    { status: 503, headers: { "Set-Cookie": clearHomeownerSessionCookie(environment) } },
  );
}

export function createHomeownerEndSessionHandler(
  dependencies: HomeownerEndSessionDependencies = {},
) {
  const getEnvironment = dependencies.loadEnvironment ?? loadHomeownerServerEnvironment;
  const endSession = dependencies.endSession ?? endHomeownerSession;
  return async function handleEndSession(request: Request) {
    if (request.method !== "POST") return homeownerUnavailableResponse();

    let environment: HomeownerServerEnvironment;
    try {
      environment = getEnvironment();
    } catch {
      return homeownerJsonResponse({ available: false }, { status: 503 });
    }
    if (!hasAllowedHomeownerOrigin(request, environment)) {
      return homeownerUnavailableResponse();
    }

    const rawSession = readHomeownerSessionCookie(request);
    if (rawSession === null) return clearedNoContent(environment);

    let session;
    try {
      session = parseHomeownerSessionBearer(rawSession);
    } catch {
      return clearedNoContent(environment);
    }

    let sessionHmac: Uint8Array;
    try {
      sessionHmac = deriveSessionHmac(
        session,
        environment.expectedProjectRef,
        environment.sessionHmacKeys,
      );
    } catch {
      return operationalFailure(environment);
    }

    try {
      const outcome = await endSession(environment, {
        sessionKeyVersion: session.sessionKeyVersion,
        sessionHmac,
      });
      return outcome.kind === "ended"
        ? clearedNoContent(environment)
        : operationalFailure(environment);
    } catch {
      return operationalFailure(environment);
    }
  };
}
