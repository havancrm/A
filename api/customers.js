import { requireUser } from "../lib/auth.js";
import { allowMethods, handle, httpError, readJson } from "../lib/http.js";
import { readTab, updateCells, appendObjects } from "../lib/tabs.js";
import { ensureDailyBackup } from "../lib/backup.js";
import { CUSTOMER_EDITABLE } from "../lib/fields.js";

export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET", "PATCH"])) return;
  const user = await requireUser(req);
  const id = String(req.query.id || "").trim();

  if (req.method === "GET") {
    const { headers, rows } = await readTab("customers");
    if (id) {
      const row = rows.find((r) => r.id === id);
      if (!row) throw httpError(404, "ไม่พบลูกค้ารายนี้");
      return res.status(200).json({ customer: row });
    }
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({ headers, customers: rows });
  }

  // PATCH: change allowed fields of one customer, after a daily backup.
  if (!id) throw httpError(400, "ต้องระบุ id ลูกค้า");
  const body = await readJson(req);
  const changes = body.changes || {};
  const fields = Object.keys(changes);
  if (!fields.length) throw httpError(400, "ไม่มีข้อมูลที่จะแก้");
  const bad = fields.filter((f) => !CUSTOMER_EDITABLE.includes(f));
  if (bad.length) throw httpError(400, "แก้ไขช่องนี้ไม่ได้: " + bad.join(", "));

  const { rows } = await readTab("customers");
  const row = rows.find((r) => r.id === id);
  if (!row) throw httpError(404, "ไม่พบลูกค้ารายนี้");

  await ensureDailyBackup();
  const before = {};
  const after = {};
  const updates = fields.map((f) => {
    before[f] = row[f] ?? "";
    after[f] = String(changes[f] ?? "");
    return { row: row._row, field: f, value: after[f] };
  });
  await updateCells("customers", updates);

  // Audit trail in the existing "changes" tab.
  const now = new Date().toISOString();
  await appendObjects("changes", [{
    at: now, entity: "customers", id, action: "update",
    before: JSON.stringify(before), after: JSON.stringify(after),
    opId: crypto.randomUUID(), deviceId: "web", user: user.email,
  }]);
  res.status(200).json({ ok: true, id, updated: fields });
});
