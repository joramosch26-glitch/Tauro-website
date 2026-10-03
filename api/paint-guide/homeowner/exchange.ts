import { createHomeownerExchangeHandler } from "../../../server/paint-guide-homeowner/exchange.js";

const handleExchange = createHomeownerExchangeHandler();

export default { fetch: handleExchange };
