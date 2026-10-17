import assert from 'node:assert/strict';
import test from 'node:test';
import { redactPaintGuideEvidence } from '../scripts/paint-guide-safe-evidence.mjs';
test('stateless evidence redaction covers issue, rotation, scheme-less AX values and nested reports', () => {
  for (const n of [1, 2, 3, 99]) {
    const token = `tpgh1.${n}.${'A'.repeat(43)}`;
    for (const prefix of ['https://www.tauropainting.com/paint-guide/p#', 'tauro-paint-guide-v1-qa.vercel.app/paint-guide/p#', 'https://www.tauropainting.com/paint-guide/p%23', '']) {
      const redacted = redactPaintGuideEvidence({ nested: [prefix + token] });
      assert.ok(!JSON.stringify(redacted).includes(token));
      assert.ok(!JSON.stringify(redacted).includes('/paint-guide/p#'));
    }
  }
});
test('evidence redaction removes session, JWT, privileged key and QR-image forms without changing metadata', () => {
  const values = ['tpgs1.1.synthetic_only', 'sb_secret_synthetic_only', 'eyJsynthetic.payload.signature', 'data:image/png;base64,synthetic_only'];
  for (const value of values) assert.notEqual(redactPaintGuideEvidence(value), value);
  assert.deepEqual(redactPaintGuideEvidence({ result: 'PASS', guideId: 'synthetic-id', count: 3 }), { result: 'PASS', guideId: 'synthetic-id', count: 3 });
});
