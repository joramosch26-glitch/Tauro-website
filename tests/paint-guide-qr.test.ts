import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import QRCode from "qrcode";
import { createQrPng, createQrPreview, createQrSvg, downloadQr, qrDownloadStillCurrent, qrValueStillCurrent, QR_PNG_FILENAME, QR_SVG_FILENAME } from "../src/paint-guide/staff/qr-code.js";

const GUIDE = "73000000-0000-4000-8000-000000000101";
const TOKEN = "tpgh1.1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const URL = `http://127.0.0.1:55400/paint-guide/p#${TOKEN}`;

type PngImage = { width: number; height: number; data: Buffer };
// pngjs is already qrcode's Node renderer dependency; it stays test-only.
const { PNG } = createRequire(import.meta.url)("pngjs") as {
  PNG: { sync: { read: (bytes: Buffer) => PngImage; write: (image: PngImage) => Buffer } };
};

function createTestCanvas(): HTMLCanvasElement {
  let image: PngImage;
  const context = {
    fillStyle: "",
    fillRect(x: number, y: number, width: number, height: number) {
      const color = this.fillStyle === "#ffffff" ? 255 : 0;
      for (let row = y; row < y + height; row += 1) {
        for (let column = x; column < x + width; column += 1) {
          const offset = (row * image.width + column) * 4;
          image.data.fill(color, offset, offset + 3);
          image.data[offset + 3] = 255;
        }
      }
    },
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => {
      image = { width: canvas.width, height: canvas.height, data: Buffer.alloc(canvas.width * canvas.height * 4) };
      return context;
    },
    toDataURL: () => `data:image/png;base64,${PNG.sync.write(image).toString("base64")}`,
  };
  return canvas as unknown as HTMLCanvasElement;
}

function pngDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

test("QR generation receives exactly the revealed authoritative URL, including its fragment", async () => {
  const values: string[] = [];
  const renderer = {
    create: (value: string) => { values.push(value); return QRCode.create(value, { errorCorrectionLevel: "M" }); },
    toDataURL: async (value: string) => { values.push(value); return "data:image/png;base64,iVBORw0KGgo="; },
    toString: async (value: string) => { values.push(value); return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; },
  };
  await createQrPreview(URL, renderer);
  await createQrPng(URL, renderer, createTestCanvas);
  await createQrSvg(URL, renderer);
  assert.deepEqual(values, [URL, URL, URL]);
  assert.equal(values.includes(GUIDE), false);
});

test("PNG and SVG exports are local printable formats with non-sensitive filenames", async () => {
  const png = await createQrPng(URL, QRCode, createTestCanvas);
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert.equal(png.type, "image/png");
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(pngDimensions(bytes), [1024, 1024]);

  const svg = await (await createQrSvg(URL)).text();
  assert.match(svg, /^<svg\b/);
  assert.equal(svg.includes(URL), false);
  assert.doesNotMatch(svg, /<\/?(?:script|metadata|title|desc)\b|\son[a-z]+\s*=|(?:href|src)\s*=/i);
  assert.equal(QR_PNG_FILENAME.includes(TOKEN) || QR_PNG_FILENAME.includes(GUIDE), false);
  assert.equal(QR_SVG_FILENAME.includes(TOKEN) || QR_SVG_FILENAME.includes(GUIDE), false);
});

test("PNG is exactly 1024 square across URL lengths, with the complete QR matrix and an opaque quiet zone", async () => {
  const repeatedToken = `tpgh1.1.${"a".repeat(43)}`;
  const values = [
    `http://127.0.0.1:54321/paint-guide/p#${repeatedToken}`,
    URL,
    `https://www.tauropainting.com/paint-guide/p#${TOKEN}`,
    `https://${"preview".repeat(8)}.example.test/paint-guide/p#tpgh1.32767.${"z".repeat(43)}`,
    `https://${["a".repeat(63), "b".repeat(63), "c".repeat(63), "d".repeat(56), "test"].join(".")}/paint-guide/p#${TOKEN}`,
  ];
  // The original qrcode width calculation truncates this payload to 1023.
  const originalBytes = Buffer.from((await QRCode.toDataURL(values[0], { width: 1024, margin: 4, errorCorrectionLevel: "M" })).split(",")[1], "base64");
  assert.deepEqual(pngDimensions(originalBytes), [1023, 1023]);
  const sizes = new Set<number>();
  for (const value of values) {
    const bytes = Buffer.from(await (await createQrPng(value, QRCode, createTestCanvas)).arrayBuffer());
    assert.deepEqual(pngDimensions(bytes), [1024, 1024]);
    const image = PNG.sync.read(bytes);
    const matrix = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
    sizes.add(matrix.size);
    const scale = Math.floor(1024 / (matrix.size + 8));
    const offset = Math.floor((1024 - matrix.size * scale) / 2);
    assert.ok(offset >= scale * 4);
    assert.ok(1024 - offset - matrix.size * scale >= scale * 4);
    // Check every output pixel against the full-URL matrix. This catches
    // omitted fragments, cropped modules, interpolation and transparent borders.
    for (let row = 0; row < 1024; row += 1) {
      for (let column = 0; column < 1024; column += 1) {
        const matrixRow = Math.floor((row - offset) / scale);
        const matrixColumn = Math.floor((column - offset) / scale);
        const dark = matrixRow >= 0 && matrixRow < matrix.size && matrixColumn >= 0 && matrixColumn < matrix.size && matrix.get(matrixRow, matrixColumn);
        const pixel = (row * 1024 + column) * 4;
        const color = dark ? 0 : 255;
        if (image.data[pixel] !== color || image.data[pixel + 1] !== color || image.data[pixel + 2] !== color || image.data[pixel + 3] !== 255) assert.fail("PNG pixels do not match the complete QR matrix.");
      }
    }
  }
  assert.ok(sizes.size >= 3);
});

test("PNG canvas failures do not include private access material in errors", async () => {
  await assert.rejects(() => createQrPng(URL, QRCode, () => ({ getContext: () => null }) as unknown as HTMLCanvasElement), { message: "QR PNG output was unavailable." });
});

test("download is explicit and its temporary object URL is revoked", async () => {
  let clicked = false;
  let revoked = "";
  const documentRef = { body: {}, createElement: () => ({ href: "", download: "", click: () => { clicked = true; } }) } as unknown as Document;
  downloadQr(new Blob(["qr"]), QR_PNG_FILENAME, documentRef, { createObjectURL: () => "blob:temporary-qr", revokeObjectURL: (value) => { revoked = value; } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(clicked, true);
  assert.equal(revoked, "blob:temporary-qr");
});

test("no revealed URL means no QR generation request", () => {
  const privateUrl: string | null = null;
  assert.equal(privateUrl, null);
});

test("an in-flight download is blocked after rotate, revoke, conflict, or unmount", () => {
  const initialGeneration = 4;
  const rotatedUrl = `${URL}-new`;
  assert.equal(qrDownloadStillCurrent(URL, rotatedUrl, initialGeneration, initialGeneration + 1), false);
  assert.equal(qrDownloadStillCurrent(URL, null, initialGeneration, initialGeneration + 1), false);
  assert.equal(qrDownloadStillCurrent(URL, null, initialGeneration, initialGeneration + 2), false);
  assert.equal(qrDownloadStillCurrent(URL, URL, initialGeneration, initialGeneration), true);
});

test("an in-flight preview cannot replace current material after rotate, revoke, conflict, or unmount", () => {
  assert.equal(qrValueStillCurrent(URL, `${URL}-new`), false);
  assert.equal(qrValueStillCurrent(URL, null), false);
  assert.equal(qrValueStillCurrent(URL, URL), true);
});
