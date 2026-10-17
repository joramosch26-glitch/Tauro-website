const BYTEA_PATTERN = /^\\x(?:[0-9a-f]{2})+$/;

export class HomeownerByteaError extends Error {
  constructor() {
    super("Homeowner bytea material is invalid.");
  }
}

export function byteaToPostgrest(value: Uint8Array) {
  if (value.length === 0) throw new HomeownerByteaError();
  return `\\x${Buffer.from(value).toString("hex")}`;
}

export function byteaFromPostgrest(value: string) {
  if (!BYTEA_PATTERN.test(value)) throw new HomeownerByteaError();
  return Buffer.from(value.slice(2), "hex");
}
