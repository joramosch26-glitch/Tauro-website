export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("/server/paint-guide-photo/handlers.js")) {
    return { url: "paint-guide-photo-mock:handlers", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url !== "paint-guide-photo-mock:handlers") return nextLoad(url, context);
  const names = [
    "createStaffPhotosHandler",
    "createStaffPhotoReadHandler",
    "createPhotoSlotDeleteHandler",
    "createHomeownerPhotoReadHandler",
  ];
  const source = names.map((name) => `export function ${name}(){ return async (request) => {
    const body = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
    const result = { factory: "${name}", method: request.method,
      url: request.url, authorization: request.headers.get("authorization"),
      cookie: request.headers.get("cookie"), contentType: request.headers.get("content-type"), body };
    return new Response(JSON.stringify(result),
      { status: request.url.includes("fixture-failure") ? 503 : 207,
        headers: { "x-route-fixture": "preserved" } });
  }; }`).join("\n");
  return { format: "module", source, shortCircuit: true };
}
