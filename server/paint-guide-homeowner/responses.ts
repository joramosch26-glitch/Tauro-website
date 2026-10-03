const HOMEOWNER_SECURITY_HEADERS = {
  "Cache-Control": "no-store, private",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function headersWithDefaults(headers?: HeadersInit) {
  const result = new Headers(headers);
  new Headers(HOMEOWNER_SECURITY_HEADERS).forEach((value, name) => {
    result.set(name, value);
  });
  return result;
}

export function homeownerJsonResponse(
  value: unknown,
  init: ResponseInit = {},
) {
  const headers = headersWithDefaults(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(value), { ...init, headers });
}

export function homeownerNoContentResponse(init: ResponseInit = {}) {
  return new Response(null, {
    ...init,
    status: init.status ?? 204,
    headers: headersWithDefaults(init.headers),
  });
}

export function homeownerUnavailableResponse(init: ResponseInit = {}) {
  return homeownerJsonResponse({ available: false }, { ...init, status: 404 });
}
