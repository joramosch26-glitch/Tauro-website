const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class HomeownerEncodingError extends Error {
  constructor() {
    super("Homeowner encoded material is invalid.");
  }
}

export function encodeBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export function decodeBase64Url(value: string) {
  if (!BASE64_URL_PATTERN.test(value) || value.length % 4 === 1) {
    throw new HomeownerEncodingError();
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || encodeBase64Url(decoded) !== value) {
    throw new HomeownerEncodingError();
  }
  return decoded;
}

export function parseCanonicalVersion(value: string) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new HomeownerEncodingError();
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version > 32767) {
    throw new HomeownerEncodingError();
  }
  return version;
}
