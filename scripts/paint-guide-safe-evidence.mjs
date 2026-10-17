// Stateless output boundary: never closes over a particular token or generation.
// Prefer boolean/metadata evidence; never capture screenshots while a link/QR is visible.
export function redactPaintGuideEvidence(value) {
  if (typeof value === 'string') return value
    .replace(/(?:https?:\/\/)?[^\s<>"']*\/paint-guide\/p(?:#|%23)[^\s<>"']*/gi, '[PRIVATE_LINK_REDACTED]')
    .replace(/tpg[hs]1\.[1-9][0-9]*\.[A-Za-z0-9_-]+/g, '[PRIVATE_TOKEN_REDACTED]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[SERVER_CREDENTIAL_REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/data:image\/(?:png|svg\+xml)[^\s<>"']*/gi, '[QR_IMAGE_REDACTED]');
  if (Array.isArray(value)) return value.map(redactPaintGuideEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactPaintGuideEvidence(item)]));
  return value;
}
