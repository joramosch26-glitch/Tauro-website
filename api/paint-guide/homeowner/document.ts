import { loadHomeownerServerEnvironment } from "../../../server/paint-guide-homeowner/env.js";
import { homeownerUnavailableResponse } from "../../../server/paint-guide-homeowner/responses.js";

async function handleDocument(request: Request) {
  if (request.method !== "GET") return homeownerUnavailableResponse();

  try {
    loadHomeownerServerEnvironment();
  } catch {
    return homeownerUnavailableResponse();
  }

  // Cookie parsing, session HMAC verification, and document RPC read arrive in 3H.3B/D.
  return homeownerUnavailableResponse();
}

export default { fetch: handleDocument };
