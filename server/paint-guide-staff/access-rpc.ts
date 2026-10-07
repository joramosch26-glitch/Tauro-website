import { timingSafeEqual } from "node:crypto";
import { byteaFromPostgrest, byteaToPostgrest } from "../paint-guide-homeowner/bytea.js";
import {
  createHomeownerAccessToken, decryptHomeownerAccessToken, deriveLookupHmac,
  encryptHomeownerAccessToken, HOMEOWNER_TOKEN_FORMAT_VERSION,
  type EncryptedHomeownerToken,
} from "../paint-guide-homeowner/crypto.js";
import type { HomeownerServerEnvironment, PaintGuideServerEnvironment } from "../paint-guide-homeowner/types.js";
import { createPaintGuideStaffClient } from "./auth.js";

export type StaffAccessOperation = "status" | "issue" | "recover" | "rotate" | "revoke";
export type StaffAccessCas = { expectedTokenGeneration: number; expectedSessionEpoch: number };
export type StaffAccessStatus = {
  guideId: string;
  guideStatus: "draft" | "published" | "archived";
  accessState: "absent" | "active" | "revoked";
  tokenGeneration: number | null;
  sessionEpoch: number | null;
  homeownerExchangeAvailable: boolean;
};
export type StaffAccessStatusResult =
  | { kind: "status"; status: StaffAccessStatus }
  | { kind: "not_found" | "operational_failure" };
export type StaffAccessMaterial = {
  guideId: string;
  tokenGeneration: number;
  sessionEpoch: number;
  lookupKeyVersion: number;
  tokenHmac: Buffer;
  encrypted: EncryptedHomeownerToken;
};
export type StaffAccessMaterialResult =
  | { kind: "active"; material: StaffAccessMaterial }
  | { kind: "revoked" | "unavailable" | "conflict" | "operational_failure" };
export type StaffAccessRevokeResult =
  | { kind: "revoked"; tokenGeneration: number; sessionEpoch: number }
  | { kind: "unavailable" | "conflict" | "operational_failure" };
export type StaffAccessRpcClient = {
  rpc(name: string, arguments_: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

// Match the UUID versions supported by the existing token AAD contract.
export function isStaffAccessGuideId(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function smallint(value: unknown): value is number {
  return positiveInteger(value) && value <= 32767;
}

export function validateStaffAccessStatus(value: unknown, guideId: string): StaffAccessStatus | null {
  if (!object(value) || !exactKeys(value, ["guide_id", "guide_status", "access_state",
    "token_generation", "session_epoch", "homeowner_exchange_available"])) return null;
  if (value.guide_id !== guideId || typeof value.guide_status !== "string" || typeof value.access_state !== "string"
    || !["draft", "published", "archived"].includes(String(value.guide_status))
    || !["absent", "active", "revoked"].includes(String(value.access_state))) return null;
  if (value.access_state === "absent"
    ? value.token_generation !== null || value.session_epoch !== null
    : !positiveInteger(value.token_generation) || !positiveInteger(value.session_epoch)) return null;
  const exchangeAvailable = value.guide_status === "published" && value.access_state === "active";
  if (value.homeowner_exchange_available !== exchangeAvailable) return null;
  return {
    guideId, guideStatus: value.guide_status as StaffAccessStatus["guideStatus"],
    accessState: value.access_state as StaffAccessStatus["accessState"],
    tokenGeneration: value.token_generation as number | null,
    sessionEpoch: value.session_epoch as number | null,
    homeownerExchangeAvailable: exchangeAvailable,
  };
}

function validateMaterial(value: unknown, guideId: string): StaffAccessMaterial | null {
  if (!object(value) || !exactKeys(value, ["guide_id", "format_version", "token_generation",
    "session_epoch", "lookup_key_version", "token_hmac", "encryption_key_version",
    "token_ciphertext", "encryption_nonce", "encryption_tag"])) return null;
  if (value.guide_id !== guideId || value.format_version !== HOMEOWNER_TOKEN_FORMAT_VERSION
    || !positiveInteger(value.token_generation) || !positiveInteger(value.session_epoch)
    || !smallint(value.lookup_key_version) || !smallint(value.encryption_key_version)) return null;
  try {
    const bytes = ["token_hmac", "token_ciphertext", "encryption_nonce", "encryption_tag"].map((key) => {
      if (typeof value[key] !== "string" || value[key].length > 258) throw new Error();
      return byteaFromPostgrest(value[key]);
    });
    const [tokenHmac, ciphertext, nonce, tag] = bytes;
    if (tokenHmac.length !== 32 || ciphertext.length === 0 || ciphertext.length > 128
      || nonce.length !== 12 || tag.length !== 16) return null;
    return { guideId, tokenGeneration: value.token_generation, sessionEpoch: value.session_epoch,
      lookupKeyVersion: value.lookup_key_version, tokenHmac,
      encrypted: { encryptionKeyVersion: value.encryption_key_version, ciphertext, nonce, tag } };
  } catch { return null; }
}

export async function callStaffAccessStatus(
  client: StaffAccessRpcClient, guideId: string, actorId: string,
): Promise<StaffAccessStatusResult> {
  try {
    const { data, error } = await client.rpc("paint_guide_homeowner_access_status",
      { p_guide_id: guideId, p_actor_id: actorId });
    if (error) return { kind: "operational_failure" };
    if (data === null) return { kind: "not_found" };
    const status = validateStaffAccessStatus(data, guideId);
    return status ? { kind: "status", status } : { kind: "operational_failure" };
  } catch { return { kind: "operational_failure" }; }
}

export async function callStaffAccessMaterial(
  client: StaffAccessRpcClient, operation: "issue" | "recover" | "rotate", environment: HomeownerServerEnvironment,
  guideId: string, actorId: string, cas?: StaffAccessCas,
): Promise<StaffAccessMaterialResult> {
  try {
    let args: Record<string, unknown> = { p_guide_id: guideId, p_actor_id: actorId };
    if (operation === "rotate") {
      if (!cas) return { kind: "operational_failure" };
      args = { ...args, p_expected_token_generation: cas.expectedTokenGeneration,
        p_expected_session_epoch: cas.expectedSessionEpoch };
    }
    if (operation === "issue" || operation === "rotate") {
      // Reuse the existing crypto for fresh candidate material. The atomic RPC
      // either issues/rotates it or returns the existing stable issued token.
      const token = createHomeownerAccessToken(environment.tokenLookupHmacKeys.activeVersion);
      try {
        const hmac = deriveLookupHmac(token, environment.expectedProjectRef, environment.tokenLookupHmacKeys);
        const encrypted = encryptHomeownerAccessToken(token, {
          environment: environment.environment, expectedProjectRef: environment.expectedProjectRef,
          guideId, formatVersion: token.formatVersion,
          encryptionKeyVersion: environment.tokenEncryptionKeys.activeVersion,
        }, environment.tokenEncryptionKeys);
        args = { ...args, p_format_version: token.formatVersion, p_lookup_key_version: token.lookupKeyVersion,
          p_token_hmac: byteaToPostgrest(hmac), p_encryption_key_version: encrypted.encryptionKeyVersion,
          p_token_ciphertext: byteaToPostgrest(encrypted.ciphertext),
          p_encryption_nonce: byteaToPostgrest(encrypted.nonce), p_encryption_tag: byteaToPostgrest(encrypted.tag) };
      } finally { token.secret.fill(0); }
    }
    const { data, error } = await client.rpc(`paint_guide_homeowner_access_${operation}`, args);
    if (error) return operation === "rotate" ? mutationFailure(error) : { kind: "operational_failure" };
    if (!object(data) || typeof data.outcome !== "string") return { kind: "operational_failure" };
    if (operation === "issue" && data.outcome === "revoked" && exactKeys(data, ["outcome"])) {
      return { kind: "revoked" };
    }
    if (operation === "recover" && data.outcome === "unavailable" && exactKeys(data, ["outcome"])) {
      return { kind: "unavailable" };
    }
    const outcomes = operation === "issue" ? ["issued", "existing"] : operation === "rotate" ? ["rotated"] : ["recovered"];
    if (!outcomes.includes(String(data.outcome)) || !exactKeys(data, ["outcome", "access"])) {
      return { kind: "operational_failure" };
    }
    const material = validateMaterial(data.access, guideId);
    if (operation === "rotate" && material) {
      if (material.tokenGeneration !== cas!.expectedTokenGeneration + 1
        || material.sessionEpoch !== cas!.expectedSessionEpoch + 1) return { kind: "operational_failure" };
      // Rotation must return precisely the fresh candidate, never old recovery material.
      const raw = data.access as Record<string, unknown>;
      for (const field of ["format_version", "lookup_key_version", "token_hmac", "encryption_key_version",
        "token_ciphertext", "encryption_nonce", "encryption_tag"]) {
        if (raw[field] !== args[`p_${field}`]) return { kind: "operational_failure" };
      }
    }
    return material ? { kind: "active", material } : { kind: "operational_failure" };
  } catch { return { kind: "operational_failure" }; }
}

function mutationFailure(error: unknown): { kind: "conflict" | "unavailable" | "operational_failure" } {
  if (object(error) && error.code === "40001") return { kind: "conflict" };
  if (object(error) && error.code === "P0002") return { kind: "unavailable" };
  return { kind: "operational_failure" };
}

export async function callStaffAccessRevoke(
  client: StaffAccessRpcClient, guideId: string, actorId: string, cas: StaffAccessCas,
): Promise<StaffAccessRevokeResult> {
  try {
    const { data, error } = await client.rpc("paint_guide_homeowner_access_revoke", {
      p_guide_id: guideId, p_actor_id: actorId,
      p_expected_token_generation: cas.expectedTokenGeneration, p_expected_session_epoch: cas.expectedSessionEpoch,
    });
    if (error) return mutationFailure(error);
    if (!object(data) || !exactKeys(data, ["outcome", "token_generation", "session_epoch"])
      || !["revoked", "already_revoked"].includes(String(data.outcome))
      || typeof data.outcome !== "string" || !positiveInteger(data.token_generation)
      || !positiveInteger(data.session_epoch)) return { kind: "operational_failure" };
    if (data.token_generation !== cas.expectedTokenGeneration) return { kind: "operational_failure" };
    // The DB deliberately accepts same-generation repeat revoke without rewriting
    // its epoch/audit. A stale epoch still conflicts at the HTTP boundary.
    if (data.outcome === "already_revoked" && data.session_epoch !== cas.expectedSessionEpoch) return { kind: "conflict" };
    if (data.session_epoch !== cas.expectedSessionEpoch + (data.outcome === "revoked" ? 1 : 0)) return { kind: "operational_failure" };
    return { kind: "revoked", tokenGeneration: data.token_generation, sessionEpoch: data.session_epoch };
  } catch { return { kind: "operational_failure" }; }
}

export function recoverStaffAccessBearer(material: StaffAccessMaterial, environment: HomeownerServerEnvironment) {
  const token = decryptHomeownerAccessToken(material.encrypted, {
    environment: environment.environment, expectedProjectRef: environment.expectedProjectRef,
    guideId: material.guideId, formatVersion: HOMEOWNER_TOKEN_FORMAT_VERSION,
    encryptionKeyVersion: material.encrypted.encryptionKeyVersion,
  }, environment.tokenEncryptionKeys);
  try {
    if (token.lookupKeyVersion !== material.lookupKeyVersion) throw new Error("Access unavailable.");
    const hmac = deriveLookupHmac(token, environment.expectedProjectRef, environment.tokenLookupHmacKeys);
    if (!timingSafeEqual(hmac, material.tokenHmac)) throw new Error("Access unavailable.");
    return token.canonical;
  } finally { token.secret.fill(0); }
}

export function staffAccessRpcClient(environment: PaintGuideServerEnvironment): StaffAccessRpcClient {
  return createPaintGuideStaffClient(environment);
}
