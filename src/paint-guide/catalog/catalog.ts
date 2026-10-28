export const COLOR_CATALOG_BRANDS = [
  { slug: "sherwin-williams", name: "Sherwin-Williams" },
  { slug: "benjamin-moore", name: "Benjamin Moore" },
  { slug: "farrow-and-ball", name: "Farrow & Ball" },
] as const;

export type ColorOriginSlug = (typeof COLOR_CATALOG_BRANDS)[number]["slug"];
export type CatalogColor = {
  id: string;
  name: string;
  code: string;
  colorOrigin: { slug: ColorOriginSlug; name: string };
  referenceHex: string;
  lrv: number | null;
  provider: "PaintDB";
  attribution: string;
  verification: "approximate-reference";
  manufacturerVerified: false;
  sourceUrl: string | null;
  retrievedAt: string;
};
export type CatalogSearchResult = {
  colors: CatalogColor[];
  total: number | null;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export class PaintCatalogError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PaintCatalogError";
  }
}

const API_BASE = "https://paintdb.com/api/v1/colors";
const brandBySlug = new Map<string, (typeof COLOR_CATALOG_BRANDS)[number]>(COLOR_CATALOG_BRANDS.map((item) => [item.slug, item]));
const ATTRIBUTION = "Paint color reference: PaintDB. Independent approximate reference; not manufacturer-verified or affiliated with the manufacturer.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeColor(value: unknown, requestedBrand: ColorOriginSlug, retrievedAt: string): CatalogColor | null {
  if (!isRecord(value) || !isRecord(value.brand)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const hex = typeof value.hex === "string" ? value.hex.trim().toUpperCase() : "";
  const slug = typeof value.brand.slug === "string" ? value.brand.slug.trim() : "";
  const origin = brandBySlug.get(slug);
  if (!id || !name || !code || !origin || slug !== requestedBrand || !/^#[\da-f]{6}$/i.test(hex)) return null;
  const lrv = typeof value.lrv === "number" && Number.isFinite(value.lrv) && value.lrv >= 0 && value.lrv <= 100 ? value.lrv : null;
  let sourceUrl: string | null = null;
  if (typeof value.url === "string") {
    try {
      const parsed = new URL(value.url);
      if (parsed.origin === "https://paintdb.com" && parsed.pathname.startsWith("/colors/")) sourceUrl = parsed.href;
    } catch { /* Invalid provider URLs are omitted from the reference result. */ }
  }
  return {
    id, name, code,
    colorOrigin: { slug: origin.slug, name: origin.name },
    referenceHex: hex,
    lrv,
    provider: "PaintDB",
    attribution: ATTRIBUTION,
    verification: "approximate-reference",
    manufacturerVerified: false,
    sourceUrl,
    retrievedAt,
  };
}

/** Performs one on-demand search. Catalog responses are not cached or persisted. */
export async function searchPaintColors(options: {
  brand: ColorOriginSlug;
  query: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<CatalogSearchResult> {
  const { brand } = options;
  const query = typeof options.query === "string" ? options.query.trim() : "";
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 20;
  if (!brandBySlug.has(brand)) throw new PaintCatalogError("Choose a supported color-origin brand.", "unsupported_brand");
  if (!query || query.length > 80) throw new PaintCatalogError("Enter a color name or code (up to 80 characters).", "invalid_query");
  if (!Number.isSafeInteger(page) || page < 0) throw new PaintCatalogError("Page must be a non-negative integer.", "invalid_page");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new PaintCatalogError("Page size must be from 1 to 100.", "invalid_page_size");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new PaintCatalogError("Color catalog search is unavailable.", "fetch_unavailable");

  const url = new URL(API_BASE);
  url.searchParams.set("brand", brand);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String(page * pageSize));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Catalog request timed out.", "TimeoutError")), options.timeoutMs ?? 8000);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  let body: unknown;
  let parsingResponse = false;
  try {
    const response = await fetchImpl(url, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    if (response.status === 429) throw new PaintCatalogError("The reference catalog is rate-limiting requests. Wait briefly or enter the color manually.", "rate_limited");
    if (!response.ok) throw new PaintCatalogError("Color search is temporarily unavailable. You can enter the color manually.", "http_error");
    parsingResponse = true;
    try {
      body = await response.json();
    } catch {
      if (controller.signal.aborted) throw new Error("request_aborted");
      throw new PaintCatalogError("The reference catalog returned an unreadable response.", "invalid_json");
    }
  } catch (error) {
    if (error instanceof PaintCatalogError) throw error;
    if (options.signal?.aborted) throw new PaintCatalogError("Color search was cancelled.", "cancelled");
    if (controller.signal.aborted) throw new PaintCatalogError("Color search timed out. You can retry or enter the color manually.", "timeout");
    if (parsingResponse) throw new PaintCatalogError("The reference catalog returned an unreadable response.", "invalid_json");
    throw new PaintCatalogError("Color search could not reach the reference catalog. Enter the color manually or retry.", "network_error");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) throw new PaintCatalogError("The reference catalog returned an unexpected response.", "invalid_response");
  const total = Number.isSafeInteger(body.meta.total) && (body.meta.total as number) >= 0 ? body.meta.total as number : null;
  const retrievedAt = new Date().toISOString();
  const colors = body.data.map((item) => normalizeColor(item, brand, retrievedAt)).filter((item): item is CatalogColor => item !== null);
  return { colors, total, page, pageSize, hasMore: total === null ? colors.length === pageSize : (page + 1) * pageSize < total };
}

export function catalogReferenceForSelection(color: CatalogColor) {
  if (color.manufacturerVerified !== false || color.verification !== "approximate-reference" || !/^#[\da-f]{6}$/i.test(color.referenceHex)
    || !color.sourceUrl || !Number.isFinite(Date.parse(color.retrievedAt))) {
    throw new PaintCatalogError("Select a valid catalog reference first.", "invalid_selection");
  }
  return {
    colorOriginBrand: color.colorOrigin.name,
    colorReferenceHex: color.referenceHex.toUpperCase(),
    colorReferenceProvider: color.provider,
    colorReferenceId: color.id,
    colorReferenceUrl: color.sourceUrl,
    colorReferenceRetrievedAt: color.retrievedAt,
  };
}

export function applyCatalogReference<T extends {
  colorName: string; colorCode: string; colorOriginBrand: string; colorReferenceHex: string;
  colorReferenceProvider: string; colorReferenceId: string;
  colorReferenceUrl: string; colorReferenceRetrievedAt: string;
}>(current: T, color: CatalogColor): T {
  const reference = catalogReferenceForSelection(color);
  return {
    ...current,
    colorName: color.name,
    colorCode: color.code,
    ...reference,
  };
}

export const colorCatalogAttribution = ATTRIBUTION;
