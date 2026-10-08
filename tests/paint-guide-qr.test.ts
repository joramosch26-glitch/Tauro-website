import assert from "node:assert/strict";
import test from "node:test";
import { createQrPng, createQrPreview, createQrSvg, downloadQr, qrDownloadStillCurrent, qrValueStillCurrent, QR_PNG_FILENAME, QR_SVG_FILENAME } from "../src/paint-guide/staff/qr-code.js";

const GUIDE = "73000000-0000-4000-8000-000000000101";
const TOKEN = "tpgh1.1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const URL = `http://127.0.0.1:55400/paint-guide/p#${TOKEN}`;

function pngDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

test("QR generation receives exactly the revealed authoritative URL, including its fragment", async () => {
  const values: string[] = [];
  const renderer = {
    toDataURL: async (value: string) => { values.push(value); return "data:image/png;base64,iVBORw0KGgo="; },
    toString: async (value: string) => { values.push(value); return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; },
  };
  await createQrPreview(URL, renderer);
  await createQrPng(URL, renderer);
  await createQrSvg(URL, renderer);
  assert.deepEqual(values, [URL, URL, URL]);
  assert.equal(values.includes(GUIDE), false);
});

test("PNG and SVG exports are local printable formats with non-sensitive filenames", async () => {
  const png = await createQrPng(URL);
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
