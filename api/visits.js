import { requireUser } from "../lib/auth.js";
import { allowMethods, handle, httpError, readJson } from "../lib/http.js";
import { readTab, appendObjects } from "../lib/tabs.js";
import { ensureDailyBackup } from "../lib/backup.js";

const OUTCOMES = ["ยังไม่สั่ง สินค้ายังเหลือ", "สั่งแล้ว", "ไม่อยู่", "ขอให้โทรมาใหม่", "อื่นๆ"];

function newVisitId() {
  return "V-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 4).toUpperCase();
}

export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET", "POST"])) return;
  const user = await requireUser(req);

  if (req.method === "GET") {
    const customerId = String(req.query.customerId || "").trim();
    const { rows } = await readTab("visits");
    const list = rows
      .filter((v) => !customerId || v.customerId === customerId)
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, 200);
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({ visits: list });
  }

  const body = await readJson(req);
  const customerId = String(body.customerId || "").trim();
  if (!customerId) throw httpError(400, "ต้องระบุลูกค้า");
  if (body.outcome && !OUTCOMES.includes(body.outcome)) throw httpError(400, "ผลการเยี่ยมไม่ถูกต้อง");

  await ensureDailyBackup();
  const now = new Date().toISOString();
  const visit = {
    visitId: newVisitId(),
    customerId,
    at: now,
    source: "CRM web",
    note: String(body.note || "").slice(0, 2000),
    status: "COMPLETED",
    completedAt: now,
    outcome: body.outcome || "",
    opId: crypto.randomUUID(),
    updatedAt: now,
    data: JSON.stringify({ by: user.email }),
  };
  await appendObjects("visits", [visit]);
  res.status(201).json({ ok: true, visit });
});
