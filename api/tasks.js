import { requireUser } from "../lib/auth.js";
import { allowMethods, handle, httpError, readJson } from "../lib/http.js";
import { readTab, updateCells, appendObjects } from "../lib/tabs.js";
import { ensureDailyBackup } from "../lib/backup.js";

export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET", "POST", "PATCH"])) return;
  const user = await requireUser(req);

  if (req.method === "GET") {
    const { rows } = await readTab("tasks");
    const list = rows
      .filter((t) => t.status !== "deleted")
      .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({ tasks: list });
  }

  await ensureDailyBackup();

  if (req.method === "POST") {
    const body = await readJson(req);
    const customerId = String(body.customerId || "").trim();
    if (!customerId) throw httpError(400, "ต้องระบุลูกค้า");
    const now = new Date().toISOString();
    const task = {
      taskId: "T-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 4).toUpperCase(),
      customerId,
      type: body.type || "ติดตาม",
      title: String(body.title || "ติดตาม").slice(0, 200),
      dueAt: String(body.dueAt || "").slice(0, 10),
      status: "open",
      priority: body.priority || "",
      note: String(body.note || "").slice(0, 2000),
      owner: user.email,
      updatedAt: now,
      data: JSON.stringify({ by: user.email }),
      opId: crypto.randomUUID(),
      createdAt: now,
      completedAt: "",
    };
    await appendObjects("tasks", [task]);
    return res.status(201).json({ ok: true, task });
  }

  // PATCH ?taskId=  body { status: "open" | "done" }
  const taskId = String(req.query.taskId || "").trim();
  if (!taskId) throw httpError(400, "ต้องระบุงาน");
  const body = await readJson(req);
  if (!["open", "done"].includes(body.status)) throw httpError(400, "สถานะไม่ถูกต้อง");
  const { headers, rows } = await readTab("tasks");
  const row = rows.find((t) => t.taskId === taskId);
  if (!row) throw httpError(404, "ไม่พบงานนี้");
  const now = new Date().toISOString();
  const updates = [
    { row: row._row, field: "status", value: body.status },
    { row: row._row, field: "updatedAt", value: now },
    { row: row._row, field: "completedAt", value: body.status === "done" ? now : "" },
  ].filter((u) => headers.includes(u.field));
  await updateCells("tasks", updates);
  res.status(200).json({ ok: true, taskId, status: body.status });
});
