import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import {
  decodeBase64Url,
  encodeBase64Url,
  parseCanonicalVersion,
} from "./encoding.js";
import type { HomeownerEnvironment, VersionedKeyring } from "./types.js";

export const HOMEOWNER_TOKEN_FORMAT_VERSION = 1;
const TOKEN_PREFIX = "tpgh1";
const TOKEN_SECRET_BYTES = 32;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const LOOKUP_HMAC_DOMAIN = "tauro.paint-guide.homeowner.lookup-hmac.v1";
const TOKEN_AAD_DOMAIN = "tauro.paint-guide.homeowner.token-aad.v1";

export class HomeownerCryptoError extends Error {
  constructor() {
    super("Homeowner cryptographic material is invalid.");
  }
}

export type HomeownerAccessToken = {
  formatVersion: typeof HOMEOWNER_TOKEN_FORMAT_VERSION;
  lookupKeyVersion: number;
  secret: Buffer;
  canonical: string;
};

export type HomeownerTokenAadContext = {
  environment: HomeownerEnvironment;
  expectedProjectRef: string;
  guideId: string;
  formatVersion: number;
  encryptionKeyVersion: number;
};

export type EncryptedHomeownerToken = {
  encryptionKeyVersion: number;
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
};

function keyForVersion(keyring: VersionedKeyring, version: number) {
  const key = keyring.keys.get(version);
  if (!key || key.length !== 32) throw new HomeownerCryptoError();
  return key;
}

function hmacInput(domain: string, projectRef: string, bearer: string) {
  return Buffer.from(`${domain}\0${projectRef}\0${bearer}`, "utf8");
}

function tokenAad(context: HomeownerTokenAadContext) {
  if (
    context.formatVersion !== HOMEOWNER_TOKEN_FORMAT_VERSION ||
    !/^[a-z0-9]{20}$/.test(context.expectedProjectRef) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.guideId) ||
    !Number.isSafeInteger(context.encryptionKeyVersion) ||
    context.encryptionKeyVersion < 1 ||
    context.encryptionKeyVersion > 32767
  ) {
    throw new HomeownerCryptoError();
  }

  return Buffer.from(
    `${TOKEN_AAD_DOMAIN}\0${context.environment}\0${context.expectedProjectRef}\0${context.guideId.toLowerCase()}\0${context.formatVersion}\0${context.encryptionKeyVersion}`,
    "utf8",
  );
}

export function createHomeownerAccessToken(lookupKeyVersion: number): HomeownerAccessToken {
  if (!Number.isSafeInteger(lookupKeyVersion) || lookupKeyVersion < 1 || lookupKeyVersion > 32767) {
    throw new HomeownerCryptoError();
  }
  const secret = randomBytes(TOKEN_SECRET_BYTES);
  const canonical = `${TOKEN_PREFIX}.${lookupKeyVersion}.${encodeBase64Url(secret)}`;
  return { formatVersion: HOMEOWNER_TOKEN_FORMAT_VERSION, lookupKeyVersion, secret, canonical };
}

export function parseHomeownerAccessToken(value: string): HomeownerAccessToken {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw new HomeownerCryptoError();

  let lookupKeyVersion: number;
  let secret: Buffer;
  try {
    lookupKeyVersion = parseCanonicalVersion(parts[1]);
    secret = decodeBase64Url(parts[2]);
  } catch {
    throw new HomeownerCryptoError();
  }
  if (secret.length !== TOKEN_SECRET_BYTES) throw new HomeownerCryptoError();

  const canonical = `${TOKEN_PREFIX}.${lookupKeyVersion}.${encodeBase64Url(secret)}`;
  if (canonical !== value) throw new HomeownerCryptoError();
  return { formatVersion: HOMEOWNER_TOKEN_FORMAT_VERSION, lookupKeyVersion, secret, canonical };
}

export function deriveLookupHmac(
  token: HomeownerAccessToken,
  expectedProjectRef: string,
  lookupKeys: VersionedKeyring,
) {
  const key = keyForVersion(lookupKeys, token.lookupKeyVersion);
  return createHmac("sha256", key)
    .update(hmacInput(LOOKUP_HMAC_DOMAIN, expectedProjectRef, token.canonical))
    .digest();
}

export function encryptHomeownerAccessToken(
  token: HomeownerAccessToken,
  context: HomeownerTokenAadContext,
  encryptionKeys: VersionedKeyring,
): EncryptedHomeownerToken {
  const encryptionKeyVersion = encryptionKeys.activeVersion;
  const key = keyForVersion(encryptionKeys, encryptionKeyVersion);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: AES_GCM_TAG_BYTES });
  cipher.setAAD(tokenAad({ ...context, encryptionKeyVersion }));
  const ciphertext = Buffer.concat([cipher.update(token.canonical, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (ciphertext.length === 0 || tag.length !== AES_GCM_TAG_BYTES) {
    throw new HomeownerCryptoError();
  }
  return { encryptionKeyVersion, ciphertext, nonce, tag };
}

export function decryptHomeownerAccessToken(
  encrypted: EncryptedHomeownerToken,
  context: HomeownerTokenAadContext,
  encryptionKeys: VersionedKeyring,
) {
  if (
    encrypted.nonce.length !== AES_GCM_NONCE_BYTES ||
    encrypted.tag.length !== AES_GCM_TAG_BYTES ||
    encrypted.ciphertext.length === 0
  ) {
    throw new HomeownerCryptoError();
  }
  const key = keyForVersion(encryptionKeys, encrypted.encryptionKeyVersion);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce, {
      authTagLength: AES_GCM_TAG_BYTES,
    });
    decipher.setAAD(tokenAad({ ...context, encryptionKeyVersion: encrypted.encryptionKeyVersion }));
    decipher.setAuthTag(encrypted.tag);
    return parseHomeownerAccessToken(
      Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString("utf8"),
    );
  } catch {
    throw new HomeownerCryptoError();
  }
}
