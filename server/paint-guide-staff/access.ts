import { loadHomeownerServerEnvironment, loadPaintGuideServerEnvironment } from "../paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../paint-guide-homeowner/origin.js";
import { homeownerJsonResponse } from "../paint-guide-homeowner/responses.js";
import type { HomeownerServerEnvironment, PaintGuideServerEnvironment } from "../paint-guide-homeowner/types.js";
import { requirePaintGuideStaff, paintGuideStaffFailureResponse } from "./auth.js";
import {
  callStaffAccessMaterial, callStaffAccessRevoke, callStaffAccessStatus, isStaffAccessGuideId,
  recoverStaffAccessBearer, staffAccessRpcClient,
  type StaffAccessCas, type StaffAccessOperation, type StaffAccessRpcClient,
} from "./access-rpc.js";

type StaffAccessDependencies = {
  authorize?: typeof requirePaintGuideStaff;
  loadEnvironment?: () => PaintGuideServerEnvironment;
  loadCryptoEnvironment?: () => HomeownerServerEnvironment;
  createClient?: (environment: PaintGuideServerEnvironment) => StaffAccessRpcClient;
};
const MAX_REQUEST_BYTES = 1024;

async function parseAccessRequest(request: Request, operation: StaffAccessOperation): Promise<({ guideId: string } & Partial<StaffAccessCas>) | null> {
  if (request.headers.get("content-type") !== "application/json") return null;
  const advertisedLength = request.headers.get("content-length");
  if (advertisedLength !== null && (!/^[0-9]+$/.test(advertisedLength)
    || !Number.isSafeInteger(Number(advertisedLength)) || Number(advertisedLength) > MAX_REQUEST_BYTES)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_REQUEST_BYTES) return null;
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.getPrototypeOf(body) !== Object.prototype) return null;
    const value = body as Record<string, unknown>;
    if (!isStaffAccessGuideId(value.guideId)) return null;
    if (operation !== "rotate" && operation !== "revoke") return Object.keys(value).length === 1 ? { guideId: value.guideId } : null;
    if (Object.keys(value).length !== 3) return null;
    const { expectedTokenGeneration, expectedSessionEpoch } = value;
    if (typeof expectedTokenGeneration !== "number" || !Number.isSafeInteger(expectedTokenGeneration) || expectedTokenGeneration < 1
      || typeof expectedSessionEpoch !== "number" || !Number.isSafeInteger(expectedSessionEpoch) || expectedSessionEpoch < 1
      // Counters and their increments must remain exactly representable in JSON.
      || !Number.isSafeInteger(expectedSessionEpoch + 1)
      || (operation === "rotate" && !Number.isSafeInteger(expectedTokenGeneration + 1))) return null;
    return { guideId: value.guideId, expectedTokenGeneration, expectedSessionEpoch };
  } catch { return null; }
}

export function canonicalStaffHomeownerOrigin(request: Request, environment: PaintGuideServerEnvironment) {
  if (!hasAllowedHomeownerOrigin(request, environment)) throw new Error("Access unavailable.");
  if (environment.environment === "production") return "https://www.tauropainting.com";
  const origin = new URL(request.headers.get("origin")!);
  if (origin.protocol !== "https:" && (origin.protocol !== "http:"
    || !["127.0.0.1", "localhost"].includes(origin.hostname))) throw new Error("Access unavailable.");
  return origin.origin;
}

export function createStaffAccessHandler(operation: StaffAccessOperation, dependencies: StaffAccessDependencies = {}) {
  const authorize = dependencies.authorize ?? requirePaintGuideStaff;
  const loadEnvironment = dependencies.loadEnvironment ?? loadPaintGuideServerEnvironment;
  const loadCryptoEnvironment = dependencies.loadCryptoEnvironment ?? loadHomeownerServerEnvironment;
  const createClient = dependencies.createClient ?? staffAccessRpcClient;
  const unavailable = (status: number) => homeownerJsonResponse({ available: false }, { status });

  return async function handleStaffAccess(request: Request) {
    if (request.method !== "POST") return homeownerJsonResponse({ available: false }, { status: 405, headers: { Allow: "POST" } });
    try {
      const environment = loadEnvironment();
      if (!hasAllowedHomeownerOrigin(request, environment)) return unavailable(403);
      const mutating = operation === "rotate" || operation === "revoke";
      const staff = await authorize(request, mutating ? ["owner"] : ["owner", "supervisor"]);
      if (staff.kind !== "authorized") return paintGuideStaffFailureResponse(staff.reason);
      const input = await parseAccessRequest(request, operation);
      if (input === null) return unavailable(400);
      const { guideId } = input;
      const cas = mutating ? input as { guideId: string } & StaffAccessCas : undefined;
      const client = createClient(environment);
      const initial = await callStaffAccessStatus(client, guideId, staff.staff.userId);
      if (initial.kind !== "status") return unavailable(initial.kind === "not_found" ? 404 : 503);
      if (operation === "status") return homeownerJsonResponse(initial.status);
      if (cas) {
        if (initial.status.accessState === "absent") return unavailable(404);
        if (initial.status.tokenGeneration !== cas.expectedTokenGeneration
          || initial.status.sessionEpoch !== cas.expectedSessionEpoch) return unavailable(409);
      }
      if (operation === "revoke") {
        const result = await callStaffAccessRevoke(client, guideId, staff.staff.userId, cas!);
        if (result.kind !== "revoked") return unavailable(result.kind === "conflict" ? 409 : result.kind === "unavailable" ? 404 : 503);
        const latest = await callStaffAccessStatus(client, guideId, staff.staff.userId);
        if (latest.kind !== "status") return unavailable(latest.kind === "not_found" ? 404 : 503);
        if (latest.status.accessState !== "revoked" || latest.status.tokenGeneration !== result.tokenGeneration
          || latest.status.sessionEpoch !== result.sessionEpoch) return unavailable(409);
        return homeownerJsonResponse(latest.status);
      }
      if (operation !== "rotate" && initial.status.accessState === "revoked") return homeownerJsonResponse(initial.status, { status: 409 });
      if (operation === "recover" && initial.status.accessState === "absent") return unavailable(404);

      const cryptoEnvironment = loadCryptoEnvironment();
      // Separate loaders must still describe exactly the same backend boundary.
      if (cryptoEnvironment.supabaseUrl.toString() !== environment.supabaseUrl.toString()
        || cryptoEnvironment.expectedProjectRef !== environment.expectedProjectRef
        || cryptoEnvironment.environment !== environment.environment
        || cryptoEnvironment.supabaseSecretKey !== environment.supabaseSecretKey) return unavailable(503);
      const origin = canonicalStaffHomeownerOrigin(request, cryptoEnvironment);
      const result = await callStaffAccessMaterial(client, operation, cryptoEnvironment, guideId, staff.staff.userId, cas);
      if (result.kind === "conflict") return unavailable(409);
      if (result.kind === "unavailable") return unavailable(404);
      if (result.kind === "operational_failure") return unavailable(503);
      // Re-read metadata after the RPC: never attach stale publication/CAS data
      // to a recovered credential if an intervening mutation changed it.
      const latest = await callStaffAccessStatus(client, guideId, staff.staff.userId);
      if (latest.kind !== "status") return unavailable(latest.kind === "not_found" ? 404 : 503);
      if (latest.status.accessState === "revoked") return homeownerJsonResponse(latest.status, { status: 409 });
      if (result.kind !== "active" || latest.status.accessState !== "active"
        || latest.status.tokenGeneration !== result.material.tokenGeneration
        || latest.status.sessionEpoch !== result.material.sessionEpoch) return unavailable(operation === "rotate" ? 409 : 503);
      const privateUrl = `${origin}/paint-guide/p#${recoverStaffAccessBearer(result.material, cryptoEnvironment)}`;
      return homeownerJsonResponse({ ...latest.status, privateUrl });
    } catch { return unavailable(503); }
  };
}
