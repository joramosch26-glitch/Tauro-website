import sharp, { type Metadata } from "sharp";

export const PHOTO_LIMITS = {
  uploadBytes: 3 * 1024 * 1024,
  requestBytes: 4 * 1024 * 1024,
  pixels: 20_000_000,
  edge: 2400,
  fullBytes: 4 * 1024 * 1024,
  thumbBytes: 1024 * 1024,
} as const;

// Formula labels retain original oriented pixel dimensions and use lossless WebP.
// Oversize output is rejected; it is never resized or re-encoded at lower quality.
export const FORMULA_LABEL_LIMITS = {
  uploadBytes: 16 * 1024 * 1024,
  requestBytes: 17 * 1024 * 1024,
  fullBytes: 20 * 1024 * 1024,
  pixels: 20_000_000,
  thumbnailEdge: 480,
} as const;

export type NormalizedPhoto = {
  originalMimeType: "image/jpeg" | "image/png" | "image/webp";
  mimeType: "image/webp";
  width: number;
  height: number;
  full: Buffer;
  thumbnail: Buffer;
};

export class PhotoInputError extends Error {
  constructor(readonly code: "too_large" | "formula_label_too_large" | "unsupported" | "invalid_image" | "too_many_pixels" | "animated" | "encode_failed") {
    super(code);
    this.name = "PhotoInputError";
  }
}

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

async function encodeWebp(input: Buffer, maxEdge: number, maximumBytes: number) {
  for (const width of [maxEdge, 2000, 1600, 1200, 900, 640, 480]) {
    if (width > maxEdge) continue;
    for (const quality of [84, 76, 68, 60]) {
      const output = await sharp(input, { failOn: "error", limitInputPixels: PHOTO_LIMITS.pixels, pages: 1 })
        .rotate()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb")
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (output.data.byteLength <= maximumBytes) return output;
    }
  }
  throw new PhotoInputError("encode_failed");
}

async function assertStripped(buffer: Buffer, decode = false) {
  const options = { failOn: "error" as const, limitInputPixels: PHOTO_LIMITS.pixels };
  const metadata = await sharp(buffer, options).metadata();
  if (metadata.format !== "webp" || metadata.exif || metadata.iptc || metadata.xmp || metadata.icc) {
    throw new PhotoInputError("encode_failed");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > PHOTO_LIMITS.pixels) {
    throw new PhotoInputError("encode_failed");
  }
  if ((metadata.pages ?? 1) !== 1) throw new PhotoInputError("encode_failed");
  if (decode) {
    // metadata() parses headers only. Force an actual decode before trusting a stored candidate.
    await sharp(buffer, { ...options, pages: 1 }).resize({ width: 1, height: 1, fit: "fill" }).raw().toBuffer();
  }
}

export async function normalizePhoto(input: Buffer): Promise<NormalizedPhoto> {
  if (!Buffer.isBuffer(input) || input.length < 1) throw new PhotoInputError("invalid_image");
  if (input.length > PHOTO_LIMITS.uploadBytes) throw new PhotoInputError("too_large");
  let metadata: Metadata;
  try {
    // Do not disable sharp's decompression-bomb pixel guard while reading the header.
    // The default multipage metadata reports animation so the input can be rejected.
    metadata = await sharp(input, { failOn: "error", limitInputPixels: PHOTO_LIMITS.pixels }).metadata();
  } catch (error) {
    if (/pixel limit/i.test(String(error))) throw new PhotoInputError("too_many_pixels");
    throw new PhotoInputError("invalid_image");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) throw new PhotoInputError("unsupported");
  if ((metadata.pages ?? 1) !== 1 || (metadata.pageHeight ?? metadata.height) !== metadata.height) throw new PhotoInputError("animated");
  if (!metadata.width || !metadata.height) throw new PhotoInputError("invalid_image");
  if (metadata.width * metadata.height > PHOTO_LIMITS.pixels) throw new PhotoInputError("too_many_pixels");

  try {
    const full = await encodeWebp(input, PHOTO_LIMITS.edge, PHOTO_LIMITS.fullBytes);
    const thumbnail = await encodeWebp(input, 480, PHOTO_LIMITS.thumbBytes);
    await Promise.all([assertStripped(full.data, true), assertStripped(thumbnail.data, true)]);
    return {
      originalMimeType: metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : "image/webp",
      mimeType: "image/webp",
      width: full.info.width,
      height: full.info.height,
      full: full.data,
      thumbnail: thumbnail.data,
    };
  } catch (error) {
    if (error instanceof PhotoInputError) throw error;
    throw new PhotoInputError("encode_failed");
  }
}

export async function normalizeFormulaLabel(input: Buffer): Promise<NormalizedPhoto> {
  if (!Buffer.isBuffer(input) || input.length < 1) throw new PhotoInputError("invalid_image");
  if (input.length > FORMULA_LABEL_LIMITS.uploadBytes) throw new PhotoInputError("too_large");
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: "error", limitInputPixels: FORMULA_LABEL_LIMITS.pixels }).metadata();
  } catch (error) {
    if (/pixel limit/i.test(String(error))) throw new PhotoInputError("too_many_pixels");
    throw new PhotoInputError("invalid_image");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) throw new PhotoInputError("unsupported");
  if ((metadata.pages ?? 1) !== 1 || (metadata.pageHeight ?? metadata.height) !== metadata.height) throw new PhotoInputError("animated");
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > FORMULA_LABEL_LIMITS.pixels) throw new PhotoInputError("too_many_pixels");
  try {
    const full = await sharp(input, { failOn: "error", limitInputPixels: FORMULA_LABEL_LIMITS.pixels, pages: 1 })
      .rotate()
      .toColourspace("srgb")
      .webp({ lossless: true, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    if (full.data.byteLength > FORMULA_LABEL_LIMITS.fullBytes) throw new PhotoInputError("formula_label_too_large");
    const thumbnail = await sharp(input, { failOn: "error", limitInputPixels: FORMULA_LABEL_LIMITS.pixels, pages: 1 })
      .rotate()
      .resize({ width: FORMULA_LABEL_LIMITS.thumbnailEdge, height: FORMULA_LABEL_LIMITS.thumbnailEdge, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .webp({ quality: 76, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    await Promise.all([assertStripped(full.data, true), assertStripped(thumbnail.data, true)]);
    return {
      originalMimeType: metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : "image/webp",
      mimeType: "image/webp",
      width: full.info.width,
      height: full.info.height,
      full: full.data,
      thumbnail: thumbnail.data,
    };
  } catch (error) {
    if (error instanceof PhotoInputError) throw error;
    throw new PhotoInputError("encode_failed");
  }
}

export async function verifyNormalizedWebp(input: Buffer, maxBytes: number) {
  if (!Buffer.isBuffer(input) || input.byteLength < 1 || input.byteLength > maxBytes) throw new PhotoInputError("encode_failed");
  try {
    await assertStripped(input, true);
  } catch {
    throw new PhotoInputError("encode_failed");
  }
}
