import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, parseCsv } from "../lib/csv.js";
import { cached, bust } from "../lib/cache.js";
import { CUSTOMER_EDITABLE } from "../lib/fields.js";
import { colLetter } from "../lib/tabs.js";
import { bangkokDate } from "../lib/backup.js";

test("csv round-trips commas, quotes and newlines", () => {
  const table = [["id", "note"], ["1", 'ร้าน "A", ชั้น 2\nโทร 096'], ["2", ""]];
  assert.deepEqual(parseCsv(toCsv(table)), table);
});

test("csv keeps leading zeros as text and accepts CRLF and BOM", () => {
  const rows = parseCsv("﻿code,name\r\n0001,มีของฝาก\r\n");
  assert.deepEqual(rows, [["code", "name"], ["0001", "มีของฝาก"]]);
});

test("csv drops a trailing empty line", () => {
  assert.deepEqual(parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
});

test("cache returns stored value until ttl expires", async () => {
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cached("k", 60_000, load), 1);
  assert.equal(await cached("k", 60_000, load), 1);
  bust("k");
  assert.equal(await cached("k", 60_000, load), 2);
});

test("editable customer fields exclude the key and audit columns", () => {
  for (const f of ["id", "updatedAt", "photoFolderId", "storePhotoFileIds", "visitLog"]) {
    assert.ok(!CUSTOMER_EDITABLE.includes(f), f + " must not be editable");
  }
  assert.ok(CUSTOMER_EDITABLE.includes("phone"));
});

test("column letters follow sheet order", () => {
  assert.equal(colLetter(0), "A");
  assert.equal(colLetter(25), "Z");
  assert.equal(colLetter(26), "AA");
  assert.equal(colLetter(37), "AL");
});

test("bangkok date is the calendar day in UTC+7", () => {
  assert.equal(bangkokDate(new Date("2026-11-18T18:00:00Z")), "2026-11-19");
  assert.equal(bangkokDate(new Date("2026-11-18T10:00:00Z")), "2026-11-18");
});
