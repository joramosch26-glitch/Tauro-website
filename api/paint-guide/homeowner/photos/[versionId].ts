import { createHomeownerPhotoReadHandler } from "../../../../server/paint-guide-photo/handlers.js";
import { createHomeownerPreviewTimedHandler } from "../../../../server/paint-guide-homeowner/server-timing.js";

export default { fetch: createHomeownerPreviewTimedHandler(createHomeownerPhotoReadHandler()) };
