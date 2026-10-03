import { createHmac, randomBytes } from "node:crypto";
import {
  decodeBase64Url,
  encodeBase64Url,
  parseCanonicalVersion,
} from "./encoding.js";
import type { VersionedKeyring } from "./types.js";

const SESSION_PREFIX = "tpgs1";
const SESSION_SECRET_BYTES = 32;
const SESSION_HMAC_DOMAIN = "tauro.paint-guide.homeowner.session-hmac.v1";

export class HomeownerSessionError extends Error {
  constructor() {
    super("Homeowner session material is invalid.");
  }
}

export type HomeownerSessionBearer = {
  sessionKeyVersion: number;
  secret: Buffer;
  canonical: string;
};

export function createHomeownerSessionBearer(sessionKeyVersion: number): HomeownerSessionBearer {
  if (!Number.isSafeInteger(sessionKeyVersion) || sessionKeyVersion < 1 || sessionKeyVersion > 32767) {
    throw new HomeownerSessionError();
  }
  const secret = randomBytes(SESSION_SECRET_BYTES);
  return {
    sessionKeyVersion,
    secret,
    canonical: `${SESSION_PREFIX}.${sessionKeyVersion}.${encodeBase64Url(secret)}`,
  };
}

export function parseHomeownerSessionBearer(value: string): HomeownerSessionBearer {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_PREFIX) throw new HomeownerSessionError();

  let sessionKeyVersion: number;
  let secret: Buffer;
  try {
    sessionKeyVersion = parseCanonicalVersion(parts[1]);
    secret = decodeBase64Url(parts[2]);
  } catch {
    throw new HomeownerSessionError();
  }
  if (secret.length !== SESSION_SECRET_BYTES) throw new HomeownerSessionError();

  const canonical = `${SESSION_PREFIX}.${sessionKeyVersion}.${encodeBase64Url(secret)}`;
  if (canonical !== value) throw new HomeownerSessionError();
  return { sessionKeyVersion, secret, canonical };
}

export function deriveSessionHmac(
  bearer: HomeownerSessionBearer,
  expectedProjectRef: string,
  sessionKeys: VersionedKeyring,
) {
  const key = sessionKeys.keys.get(bearer.sessionKeyVersion);
  if (!key || key.length !== 32) throw new HomeownerSessionError();
  return createHmac("sha256", key)
    .update(`${SESSION_HMAC_DOMAIN}\0${expectedProjectRef}\0${bearer.canonical}`, "utf8")
    .digest();
}
