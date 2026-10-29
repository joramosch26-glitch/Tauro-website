import { createHomeownerDocumentHandler } from "../../../server/paint-guide-homeowner/document-handler.js";
import { createHomeownerPreviewTimedHandler } from "../../../server/paint-guide-homeowner/server-timing.js";

const handleDocument = createHomeownerPreviewTimedHandler(createHomeownerDocumentHandler());

export default { fetch: handleDocument };
