import { requireUser, requireAdmin } from "../lib/auth.js";
import { allowMethods, handle, httpError, readJson } from "../lib/http.js";
import { readTab, appendObjects } from "../lib/tabs.js";
import { parseCsv } from "../lib/csv.js";
import { copySheet, bangkokDate } from "../lib/backup.js";

const IMPORTABLE = ["customers", "customer_phones", "customer_labels", "products", "visits", "tasks"];
const MAX_ROWS = 2000;

// POST { tab, csv }  (admin only)
// Adds rows whose first column (the key) is not already in the tab. Existing rows are never changed.
// A full backup is made first, always.
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["POST"])) return;
  const user = await requireUser(req);
  requireAdmin(user);

  const body = await readJson(req);
  const tab = String(body.tab || "");
  if (!IMPORTABLE.includes(tab)) throw httpError(400, "ไม่รองรับการนำเข้าแท็บนี้");
  const parsed = parseCsv(String(body.csv || ""));
  if (parsed.length < 2) throw httpError(400, "ไฟล์ไม่มีข้อมูล");
  if (parsed.length - 1 > MAX_ROWS) throw httpError(400, "นำเข้าได้ไม่เกิน " + MAX_ROWS + " แถวต่อครั้ง");

  const csvHeaders = parsed[0].map((h) => h.trim());
  const { headers, rows: existing } = await readTab(tab);
  const unknown = csvHeaders.filter((h) => !headers.includes(h));
  if (unknown.length) throw httpError(400, "คอลัมน์ที่ไม่รู้จัก: " + unknown.join(", "));
  const key = headers[0];
  if (!csvHeaders.includes(key)) throw httpError(400, "ไฟล์ต้องมีคอลัมน์ " + key);

  const backup = await copySheet(`A-backup-${bangkokDate()}-before-import-${tab}`);

  const seen = new Set(existing.map((r) => r[key]));
  const toAdd = [];
  let skipped = 0;
  for (const cells of parsed.slice(1)) {
    const obj = {};
    csvHeaders.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    const k = String(obj[key] || "").trim();
    if (!k || seen.has(k)) { skipped++; continue; }
    seen.add(k);
    toAdd.push(obj);
  }
  const added = await appendObjects(tab, toAdd);
  await appendObjects("changes", [{
    at: new Date().toISOString(), entity: tab, id: "import", action: "import",
    before: "{}", after: JSON.stringify({ added, skipped }),
    opId: crypto.randomUUID(), deviceId: "web", user: user.email,
  }]);
  res.status(200).json({ ok: true, added, skipped, backup: backup.name });
});
