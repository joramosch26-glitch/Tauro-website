export type StaffAccessState = "absent" | "active" | "revoked";
export type StaffGuideStatus = "draft" | "published" | "archived";
export type StaffAccessStatus = {
  guideId: string;
  guideStatus: StaffGuideStatus;
  accessState: StaffAccessState;
  tokenGeneration: number | null;
  sessionEpoch: number | null;
  homeownerExchangeAvailable: boolean;
};
export type StaffAccessOperation = "status" | "issue" | "recover" | "rotate" | "revoke";
export type StaffAccessResponse = StaffAccessStatus & { privateUrl?: string };
export type StaffAccessErrorStatus = 400 | 401 | 403 | 404 | 409 | 503 | "network";

export class StaffAccessClientError extends Error {
  constructor(public readonly status: StaffAccessErrorStatus) { super("Staff access request failed."); }
}

type Fetcher = typeof fetch;
type AccessRequest = { guideId: string; expectedTokenGeneration?: number; expectedSessionEpoch?: number };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)); }
function positiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 1; }
function privateUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      && url.pathname === "/paint-guide/p" && url.search === "" && /^#tpgh1\.[1-9][0-9]*\.[A-Za-z0-9_-]{43}$/.test(url.hash);
  } catch { return false; }
}

export function parseStaffAccessResponse(value: unknown, expectPrivateUrl: boolean): StaffAccessResponse | null {
  if (!isPlainObject(value)) return null;
  const keys = ["guideId", "guideStatus", "accessState", "tokenGeneration", "sessionEpoch", "homeownerExchangeAvailable"];
  if (!exactKeys(value, expectPrivateUrl ? [...keys, "privateUrl"] : keys)
    || typeof value.guideId !== "string" || !["draft", "published", "archived"].includes(String(value.guideStatus))
    || !["absent", "active", "revoked"].includes(String(value.accessState)) || typeof value.homeownerExchangeAvailable !== "boolean") return null;
  if (value.accessState === "absent") {
    if (value.tokenGeneration !== null || value.sessionEpoch !== null || value.homeownerExchangeAvailable) return null;
  } else if (!positiveInteger(value.tokenGeneration) || !positiveInteger(value.sessionEpoch)
    || value.homeownerExchangeAvailable !== (value.guideStatus === "published" && value.accessState === "active")) return null;
  if (expectPrivateUrl && (value.accessState !== "active" || !privateUrl(value.privateUrl))) return null;
  return value as StaffAccessResponse;
}

export function accessAvailabilityMessage(status: StaffAccessStatus) {
  if (status.accessState === "absent") return "No homeowner access has been issued.";
  if (status.accessState === "revoked") return "Unavailable. Access has been revoked.";
  if (status.guideStatus === "published") return "Available to the homeowner.";
  if (status.guideStatus === "draft") return "Not available until this guide is published.";
  return "Unavailable while this guide is archived.";
}

export function accessControls(role: "owner" | "supervisor", status: StaffAccessStatus, hasPrivateUrl: boolean) {
  return { issue: status.accessState === "absent", recover: status.accessState === "active", copy: hasPrivateUrl,
    rotate: role === "owner" && status.accessState !== "absent", revoke: role === "owner" && status.accessState === "active" };
}

export async function copyStaffPrivateUrl(value: string, clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard): Promise<boolean> {
  if (!privateUrl(value) || !clipboard?.writeText) return false;
  try { await clipboard.writeText(value); return true; } catch { return false; }
}

export async function requestStaffAccess(operation: StaffAccessOperation, accessToken: string | null | undefined, request: AccessRequest, fetcher: Fetcher = fetch): Promise<StaffAccessResponse> {
  if (!accessToken) throw new StaffAccessClientError(401);
  const mutating = operation === "rotate" || operation === "revoke";
  const body = mutating ? { guideId: request.guideId, expectedTokenGeneration: request.expectedTokenGeneration, expectedSessionEpoch: request.expectedSessionEpoch } : { guideId: request.guideId };
  try {
    const response = await fetcher(`/api/paint-guide/staff/access/${operation}`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    if (!response.ok) throw new StaffAccessClientError([400, 401, 403, 404, 409, 503].includes(response.status) ? response.status as StaffAccessErrorStatus : 503);
    const result = parseStaffAccessResponse(await response.json(), ["issue", "recover", "rotate"].includes(operation));
    if (!result) throw new StaffAccessClientError(503);
    return result;
  } catch (error) {
    if (error instanceof StaffAccessClientError) throw error;
    throw new StaffAccessClientError("network");
  }
}
