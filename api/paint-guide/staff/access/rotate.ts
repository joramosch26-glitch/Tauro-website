import { createStaffAccessHandler } from "../../../../server/paint-guide-staff/access.js";

export default { fetch: createStaffAccessHandler("rotate") };
