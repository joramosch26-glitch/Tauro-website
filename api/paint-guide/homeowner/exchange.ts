import { createHomeownerExchangeHandler } from "../../../server/paint-guide-homeowner/exchange.js";
import { createHomeownerPreviewTimedHandler } from "../../../server/paint-guide-homeowner/server-timing.js";

const handleExchange = createHomeownerPreviewTimedHandler(createHomeownerExchangeHandler());

export default { fetch: handleExchange };
