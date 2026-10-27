const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MAX_EDGE = 2400;
const PROCESSING_STEPS = [0.86, 0.78, 0.68, 0.58] as const;

export class PhotoPreparationError extends Error {
  constructor(readonly code: "too_large" | "unsupported" | "decode_failed" | "too_many_pixels" | "encode_failed" | "animated", message: string = code) {
    super(message);
    this.name = "PhotoPreparationError";
  }
}

type ImageKind = "jpeg" | "png" | "webp" | "heif";
type Header = { kind: ImageKind; width: number; height: number };
const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.subarray(p, p + n));
const be16 = (b: Uint8Array, p: number) => (b[p] << 8) | b[p + 1];
const be32 = (b: Uint8Array, p: number) => b[p] * 0x1000000 + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];
const le24 = (b: Uint8Array, p: number) => b[p] | (b[p + 1] << 8) | (b[p + 2] << 16);
const le32 = (b: Uint8Array, p: number) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const invalid = (): never => { throw new PhotoPreparationError("decode_failed"); };

function checked(kind: ImageKind, width: number, height: number): Header {
  if (!width || !height) return invalid();
  if (width * height > MAX_PIXELS) throw new PhotoPreparationError("too_many_pixels");
  return { kind, width, height };
}

function jpegHeader(b: Uint8Array): Header | undefined {
  if (b.length < 2 || b[0] !== 0xff || b[1] !== 0xd8) return;
  let p = 2, dimensions: Header | undefined, sawScan = false;
  while (p + 4 <= b.length) {
    if (b[p++] !== 0xff) return invalid();
    while (p < b.length && b[p] === 0xff) p++;
    if (p >= b.length) break;
    const marker = b[p++];
    if (marker === 0xda) { sawScan = true; break; }
    if (marker === 0xd9) break;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (p + 2 > b.length) break;
    const length = be16(b, p);
    if (length < 2) return invalid();
    if (marker === 0xe2 && length >= 6 && ascii(b, p + 2, 4) === "MPF\0") throw new PhotoPreparationError("animated");
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (length < 7 || p + length > b.length) return invalid();
      if (dimensions) throw new PhotoPreparationError("animated");
      dimensions = checked("jpeg", be16(b, p + 5), be16(b, p + 3));
    }
    if (p + length > b.length) break;
    p += length;
  }
  if (!dimensions || !sawScan) return invalid();
  return dimensions;
}

function pngHeader(b: Uint8Array): Header | undefined {
  if (b.length < 24 || ascii(b, 0, 8) !== "\x89PNG\r\n\x1a\n") return;
  if (ascii(b, 12, 4) !== "IHDR") return invalid();
  const header = checked("png", be32(b, 16), be32(b, 20));
  for (let p = 8; p + 12 <= b.length;) {
    const length = be32(b, p), type = ascii(b, p + 4, 4);
    if (type === "acTL") throw new PhotoPreparationError("animated");
    if (type === "IDAT" || type === "IEND") return header;
    if (length > b.length - p - 12) return invalid();
    p += length + 12;
  }
  return invalid();
}

function webpHeader(b: Uint8Array, fileSize: number): Header | undefined {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return;
  const declared = le32(b, 4) + 8;
  if (declared > fileSize) return invalid();
  let width = 0, height = 0, frame = false;
  for (let p = 12; p + 8 <= Math.min(declared, b.length);) {
    const type = ascii(b, p, 4), length = le32(b, p + 4), data = p + 8;
    if (data + length > b.length || data + length > declared) return invalid();
    if (type === "ANIM" || type === "ANMF") throw new PhotoPreparationError("animated");
    if (type === "VP8X" && length >= 10) {
      if (b[data] & 0x02) throw new PhotoPreparationError("animated");
      width = le24(b, data + 4) + 1; height = le24(b, data + 7) + 1;
    } else if (type === "VP8 " && length >= 10 && b[data + 3] === 0x9d && b[data + 4] === 1 && b[data + 5] === 0x2a) {
      width = (b[data + 6] | (b[data + 7] << 8)) & 0x3fff;
      height = (b[data + 8] | (b[data + 9] << 8)) & 0x3fff; frame = true;
    } else if (type === "VP8L" && length >= 5 && b[data] === 0x2f) {
      width = 1 + (((b[data + 2] & 0x3f) << 8) | b[data + 1]);
      height = 1 + (((b[data + 4] & 0x0f) << 10) | (b[data + 3] << 2) | ((b[data + 2] & 0xc0) >> 6)); frame = true;
    }
    p = data + length + (length & 1);
  }
  if (!width || (!frame && ascii(b, 12, 4) !== "VP8X")) return invalid();
  return checked("webp", width, height);
}

function heifHeader(b: Uint8Array): Header | undefined {
  if (b.length < 16 || ascii(b, 4, 4) !== "ftyp") return;
  const boxLength = be32(b, 0);
  if (boxLength < 16 || boxLength > b.length) return invalid();
  const brands = [ascii(b, 8, 4)];
  for (let p = 16; p + 4 <= boxLength; p += 4) brands.push(ascii(b, p, 4));
  if (brands.some(value => value === "avif" || value === "avis")) throw new PhotoPreparationError("unsupported");
  if (!brands.some(value => ["heic", "heix", "hevc", "hevx", "mif1"].includes(value))) return;
  if (brands.includes("msf1")) throw new PhotoPreparationError("animated");
  let width = 0, height = 0;
  for (let p = 0; p + 20 <= b.length; p++) {
    if (ascii(b, p + 4, 4) !== "ispe") continue;
    const boxSize = be32(b, p);
    if (boxSize >= 20 && p + boxSize <= b.length) {
      width = Math.max(width, be32(b, p + 12)); height = Math.max(height, be32(b, p + 16));
    }
  }
  if (!width || !height) throw new PhotoPreparationError("unsupported");
  return checked("heif", width, height);
}

async function inspectSource(file: File): Promise<Header> {
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new PhotoPreparationError("too_large");
  // Inspect the bounded source in full: WebP's image chunk can legitimately
  // extend past the initial prefix, and its declared length must be validated.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = jpegHeader(bytes) ?? pngHeader(bytes) ?? webpHeader(bytes, file.size) ?? heifHeader(bytes);
  if (!result) throw new PhotoPreparationError("unsupported");
  return result;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Photo preparation cancelled.", "AbortError");
}

async function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new PhotoPreparationError("encode_failed")), "image/webp", quality));
}

/** Client preprocessing only. The server must independently decode and re-encode before storage/promotion. */
export async function preparePhotoUpload(file: File, options: { signal?: AbortSignal } = {}): Promise<File> {
  const { signal } = options;
  assertNotAborted(signal);
  let header: Header;
  try { header = await inspectSource(file); }
  catch (error) { assertNotAborted(signal); throw error; }
  assertNotAborted(signal);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image", colorSpaceConversion: "default" }); }
  catch {
    assertNotAborted(signal);
    if (header.kind === "heif") throw new PhotoPreparationError("unsupported", "This HEIC/HEIF photo can’t be opened in this browser. Export it as a JPG and try again.");
    throw new PhotoPreparationError("decode_failed");
  }
  try {
    assertNotAborted(signal);
    if (!bitmap.width || !bitmap.height) throw new PhotoPreparationError("decode_failed");
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new PhotoPreparationError("too_many_pixels");
    let edge = Math.min(MAX_EDGE, Math.max(bitmap.width, bitmap.height));
    for (;;) {
      assertNotAborted(signal);
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      try {
        const context = canvas.getContext("2d", { alpha: true, colorSpace: "srgb" });
        if (!context) throw new PhotoPreparationError("encode_failed");
        const contextColorSpace = context.getContextAttributes?.().colorSpace;
        if (contextColorSpace && contextColorSpace !== "srgb") throw new PhotoPreparationError("encode_failed");
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, width, height);
        for (const quality of PROCESSING_STEPS) {
          assertNotAborted(signal);
          const blob = await toBlob(canvas, quality);
          assertNotAborted(signal);
          if (blob.type !== "image/webp") throw new PhotoPreparationError("encode_failed");
          if (blob.size <= MAX_UPLOAD_BYTES) return new File([blob], "photo.webp", { type: "image/webp", lastModified: Date.now() });
        }
      } finally { canvas.width = 0; canvas.height = 0; }
      if (edge <= 480) break;
      edge = Math.max(480, Math.floor(edge * 0.75));
    }
    throw new PhotoPreparationError("encode_failed");
  } finally { bitmap.close(); }
}
