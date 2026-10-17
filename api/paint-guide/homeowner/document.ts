import { createHomeownerDocumentHandler } from "../../../server/paint-guide-homeowner/document-handler.js";

const handleDocument = createHomeownerDocumentHandler();

export default { fetch: handleDocument };
