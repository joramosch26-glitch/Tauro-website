import { byteaToPostgrest } from "./bytea.js";
import { createHomeownerSupabaseAdminClient } from "./supabase-admin.js";
import type { HomeownerServerEnvironment } from "./types.js";

export type HomeownerSessionExchangeInput = {
  lookupKeyVersion: number;
  tokenHmac: Uint8Array;
  sessionKeyVersion: number;
  sessionHmac: Uint8Array;
  expiresAt: Date;
};

export type HomeownerSessionExchangeResult =
  | { kind: "exchanged" }
  | { kind: "unavailable" };

type HomeownerRpcClient = {
  rpc: (
    functionName: string,
    arguments_: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

function validSmallint(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 32767;
}

function isExpectedExchangeResult(value: unknown, expiresAt: Date) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== 1 || typeof result.expires_at !== "string") {
    return false;
  }

  return Date.parse(result.expires_at) === expiresAt.getTime();
}

export async function callHomeownerSessionExchange(
  client: HomeownerRpcClient,
  input: HomeownerSessionExchangeInput,
): Promise<HomeownerSessionExchangeResult> {
  if (
    !validSmallint(input.lookupKeyVersion) ||
    input.tokenHmac.length !== 32 ||
    !validSmallint(input.sessionKeyVersion) ||
    input.sessionHmac.length !== 32 ||
    !Number.isFinite(input.expiresAt.getTime())
  ) {
    return { kind: "unavailable" };
  }

  try {
    const { data, error } = await client.rpc(
      "paint_guide_homeowner_session_exchange",
      {
        p_lookup_key_version: input.lookupKeyVersion,
        p_token_hmac: byteaToPostgrest(input.tokenHmac),
        p_session_key_version: input.sessionKeyVersion,
        p_session_hmac: byteaToPostgrest(input.sessionHmac),
        p_expires_at: input.expiresAt.toISOString(),
      },
    );

    if (error || !isExpectedExchangeResult(data, input.expiresAt)) {
      return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  }

  return { kind: "exchanged" };
}

export function exchangeHomeownerSession(
  environment: HomeownerServerEnvironment,
  input: HomeownerSessionExchangeInput,
) {
  return callHomeownerSessionExchange(
    createHomeownerSupabaseAdminClient(environment) as unknown as HomeownerRpcClient,
    input,
  );
}
