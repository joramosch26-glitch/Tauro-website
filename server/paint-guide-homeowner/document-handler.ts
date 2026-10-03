import { clearHomeownerSessionCookie, readHomeownerSessionCookie } from "./cookies.js";
import { loadHomeownerServerEnvironment } from "./env.js";
import { homeownerJsonResponse, homeownerUnavailableResponse } from "./responses.js";
import { readHomeownerDocument, type HomeownerDocumentReadInput, type HomeownerDocumentReadResult } from "./rpc.js";
import { deriveSessionHmac, parseHomeownerSessionBearer } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";

type HomeownerDocumentDependencies = {
  loadEnvironment?: () => HomeownerServerEnvironment;
  readDocument?: (environment: HomeownerServerEnvironment, input: HomeownerDocumentReadInput) => Promise<HomeownerDocumentReadResult>;
};

function unavailableWithClearedSession(environment: HomeownerServerEnvironment) {
  return homeownerUnavailableResponse({
    headers: { "Set-Cookie": clearHomeownerSessionCookie(environment) },
  });
}

export function createHomeownerDocumentHandler(dependencies: HomeownerDocumentDependencies = {}) {
  const getEnvironment = dependencies.loadEnvironment ?? loadHomeownerServerEnvironment;
  const readDocument = dependencies.readDocument ?? readHomeownerDocument;
  return async function handleDocument(request: Request) {
    if (request.method !== "GET") return homeownerUnavailableResponse();
    let environment: HomeownerServerEnvironment;
    try {
      environment = getEnvironment();
    } catch {
      return homeownerUnavailableResponse();
    }
    try {
      const rawSession = readHomeownerSessionCookie(request);
      if (rawSession === null) return unavailableWithClearedSession(environment);
      const session = parseHomeownerSessionBearer(rawSession);
      const sessionHmac = deriveSessionHmac(session, environment.expectedProjectRef, environment.sessionHmacKeys);
      const outcome = await readDocument(environment, {
        sessionKeyVersion: session.sessionKeyVersion,
        sessionHmac,
      });
      return outcome.kind === "document"
        ? homeownerJsonResponse(outcome.document)
        : unavailableWithClearedSession(environment);
    } catch {
      return unavailableWithClearedSession(environment);
    }
  };
}
