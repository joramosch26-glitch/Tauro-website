import { createHomeownerEndSessionHandler } from "../../../server/paint-guide-homeowner/end-session.js";

const handleEndSession = createHomeownerEndSessionHandler();

export default { fetch: handleEndSession };
