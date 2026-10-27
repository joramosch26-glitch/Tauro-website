import { clearHomeownerSessionCookie, readHomeownerSessionCookie } from "./cookies.js";
import { loadHomeownerServerEnvironment } from "./env.js";
import { homeownerJsonResponse, homeownerUnavailableResponse } from "./responses.js";
import { readHomeownerDocument, type HomeownerDocumentReadInput, type HomeownerDocumentReadResult } from "./rpc.js";
import { deriveSessionHmac, parseHomeownerSessionBearer } from "./sessions.js";
import type { HomeownerServerEnvironment } from "./types.js";
import type { HomeownerGuideDocumentData } from "./document.js";
import { permitsSyntheticReleaseDocument, readSyntheticReleasePhotos, type SyntheticReleasePhoto } from "./release-gate.js";

type HomeownerDocumentDependencies = {
  loadEnvironment?: () => HomeownerServerEnvironment;
  readDocument?: (environment: HomeownerServerEnvironment, input: HomeownerDocumentReadInput) => Promise<HomeownerDocumentReadResult>;
  permitsReleaseDocument?: typeof permitsSyntheticReleaseDocument;
  readSyntheticPhotos?: (environment: HomeownerServerEnvironment, document: HomeownerGuideDocumentData) => Promise<SyntheticReleasePhoto[] | null>;
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
      if (outcome.kind !== "document"
        || !await (dependencies.permitsReleaseDocument ?? permitsSyntheticReleaseDocument)(environment, outcome.document)) {
        return unavailableWithClearedSession(environment);
      }
      if (environment.environment === "preview" && environment.syntheticRelease && outcome.document.photos === undefined) {
        const photos = await (dependencies.readSyntheticPhotos ?? readSyntheticReleasePhotos)(environment, outcome.document);
        if (photos === null) return unavailableWithClearedSession(environment);
        return homeownerJsonResponse({ ...outcome.document, photos });
      }
      return homeownerJsonResponse(outcome.document);
    } catch {
      return unavailableWithClearedSession(environment);
    }
  };
}

