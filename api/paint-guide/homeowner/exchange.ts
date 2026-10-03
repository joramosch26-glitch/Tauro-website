import { loadHomeownerServerEnvironment } from "../../../server/paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../../../server/paint-guide-homeowner/origin.js";
import { homeownerUnavailableResponse } from "../../../server/paint-guide-homeowner/responses.js";

async function handleExchange(request: Request) {
  if (request.method !== "POST") return homeownerUnavailableResponse();

  try {
    const environment = loadHomeownerServerEnvironment();
    if (!hasAllowedHomeownerOrigin(request, environment)) {
      return homeownerUnavailableResponse();
    }
  } catch {
    return homeownerUnavailableResponse();
  }

  // Token parsing, cryptography, and service-role RPC exchange arrive in 3H.3B/C.
  return homeownerUnavailableResponse();
}

export default { fetch: handleExchange };
