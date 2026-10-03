import { loadHomeownerServerEnvironment } from "../../../server/paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../../../server/paint-guide-homeowner/origin.js";
import {
  homeownerNoContentResponse,
  homeownerUnavailableResponse,
} from "../../../server/paint-guide-homeowner/responses.js";

async function handleEndSession(request: Request) {
  if (request.method !== "POST") return homeownerUnavailableResponse();

  try {
    const environment = loadHomeownerServerEnvironment();
    if (!hasAllowedHomeownerOrigin(request, environment)) {
      return homeownerUnavailableResponse();
    }
  } catch {
    return homeownerUnavailableResponse();
  }

  // Cookie clearing and any later persistent logout contract arrive in 3H.3E.
  return homeownerNoContentResponse();
}

export default { fetch: handleEndSession };
