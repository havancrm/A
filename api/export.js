import { requireUser, requireAdmin } from "../lib/auth.js";
import { allowMethods, handle, httpError } from "../lib/http.js";
import { exportTab } from "../lib/tabs.js";
import { toCsv } from "../lib/csv.js";

const TABS = ["customers", "customer_phones", "customer_labels", "bills", "bill_items", "products",
  "orders", "order_items", "visits", "tasks", "activities", "gps", "photos", "changes"];

// GET ?tab=customers -> CSV download of the whole tab (admin only)
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET"])) return;
  const user = await requireUser(req);
  requireAdmin(user);
  const tab = String(req.query.tab || "");
  if (!TABS.includes(tab)) throw httpError(400, "ไม่รู้จักแท็บนี้");
  const csv = toCsv(await exportTab(tab));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${tab}.csv"`);
  res.status(200).send("﻿" + csv);
});
