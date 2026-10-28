import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stageAPath = new URL("../supabase/migrations/20261028150000_add_color_catalog_reference_columns.sql", import.meta.url);
const stageBPath = new URL("../supabase/migrations/20261028160000_extend_homeowner_document_color_catalog.sql", import.meta.url);
const stageA = await readFile(stageAPath, "utf8");
const stageB = await readFile(stageBPath, "utf8");
const fields = [
  "color_origin_brand", "color_reference_hex", "color_reference_provider",
  "color_reference_id", "color_reference_url", "color_reference_retrieved_at",
];

test("stage A adds only nullable catalog columns and constraints; it does not alter the homeowner RPC", () => {
  assert.match(stageA, /begin;[\s\S]*commit;/i);
  assert.match(stageA, /alter table public\.paint_records/i);
  for (const field of fields) assert.match(stageA, new RegExp(`add column if not exists ${field}\\s+`, "i"));
  for (const field of fields) assert.ok(stageA.includes(`${field} is not null`), `completeness check must reject partial ${field}`);
  assert.doesNotMatch(stageA, /create\s+or\s+replace\s+function|grant\s+|revoke\s+|policy\s+/i);
  assert.doesNotMatch(stageA, /update\s+public\.|delete\s+from|insert\s+into/i);
});

test("stage B is only the same session-pinned homeowner RPC extension and preserves photos/security attributes", () => {
  assert.match(stageB, /create or replace function paint_guide_private\.homeowner_document_read\(\s*p_session_key_version smallint, p_session_hmac bytea\s*\)/i);
  assert.match(stageB, /language sql stable security invoker set search_path = ''/i);
  for (const key of ["city", "state", "property_type", "room_notes", "color_origin_brand", "color_reference_hex", "photos"]) {
    assert.ok(stageB.includes(`'${key}'`), `missing optional document key ${key}`);
  }
  for (const check of ["s.session_hmac = p_session_hmac", "s.revoked_at is null", "s.expires_at > statement_timestamp()", "s.token_generation = t.token_generation", "s.session_epoch = t.session_epoch", "g.status = 'published'", "photo_version.state = 'ready'"]) {
    assert.ok(stageB.includes(check), `missing session/photo gate ${check}`);
  }
  assert.doesNotMatch(stageB, /grant\s+|revoke\s+|create\s+policy|drop\s+|delete\s+from|insert\s+into/i);
});
