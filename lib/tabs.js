// Read and write the sheet tabs. Writes use RAW input so leading zeros (phones, codes) are kept.
import { sheetsApi, sheetId } from "./google.js";
import { cached, bust } from "./cache.js";

const READ_TTL_MS = 60_000;

export function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Returns every row of a tab as objects. _row is the 1-based sheet row number.
export function readTab(tab) {
  return cached("tab:" + tab, READ_TTL_MS, async () => {
    const res = await sheetsApi().spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: tab,
    });
    const values = res.data.values || [];
    const headers = (values[0] || []).map((h) => String(h).trim());
    const rows = values.slice(1).map((cells, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, j) => {
        if (h) obj[h] = cells[j] === undefined ? "" : String(cells[j]);
      });
      return obj;
    });
    return { headers, rows };
  });
}

export async function getHeaders(tab) {
  return (await readTab(tab)).headers;
}

// Writes one cell per entry. updates: [{ row, field, value }] for a tab with headers.
export async function updateCells(tab, updates) {
  const { headers } = await readTab(tab);
  const data = updates.map((u) => {
    const idx = headers.indexOf(u.field);
    if (idx < 0) throw new Error("ไม่พบคอลัมน์ " + u.field + " ในแท็บ " + tab);
    return { range: `${tab}!${colLetter(idx)}${u.row}`, values: [[u.value]] };
  });
  if (!data.length) return;
  await sheetsApi().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  bust("tab:" + tab);
}

// Appends objects as new rows, mapped onto the tab's header order.
export async function appendObjects(tab, objects) {
  if (!objects.length) return 0;
  const headers = await getHeaders(tab);
  const values = objects.map((obj) => headers.map((h) => (obj[h] === undefined || obj[h] === null ? "" : String(obj[h]))));
  await sheetsApi().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: tab,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  bust("tab:" + tab);
  return values.length;
}

// Full export of a tab as a 2D array (headers first), for CSV download.
export async function exportTab(tab) {
  const { headers, rows } = await readTab(tab);
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
}
