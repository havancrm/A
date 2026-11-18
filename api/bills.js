import { requireUser } from "../lib/auth.js";
import { allowMethods, handle } from "../lib/http.js";
import { readTab } from "../lib/tabs.js";

// The bills tab has no total column, so totals are the sum of bill_items.amount for each bill.
function totalsByBill(items) {
  const totals = new Map();
  for (const it of items) {
    const n = Number(it.amount);
    if (!isNaN(n)) totals.set(it.billNo, (totals.get(it.billNo) || 0) + n);
  }
  return totals;
}

// GET ?customerId=  -> bills of one customer (with totals), newest first
// GET ?no=          -> one bill with its items
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET"])) return;
  await requireUser(req);
  res.setHeader("Cache-Control", "private, max-age=30");

  const { rows: items } = await readTab("bill_items");
  const totals = totalsByBill(items);

  const no = String(req.query.no || "").trim();
  if (no) {
    const { rows: bills } = await readTab("bills");
    const bill = bills.find((b) => b.no === no);
    if (!bill) return res.status(404).json({ error: "ไม่พบบิลนี้" });
    const lines = items.filter((it) => it.billNo === no);
    return res.status(200).json({ bill: { ...bill, total: totals.get(no) || 0 }, items: lines });
  }

  const customerId = String(req.query.customerId || "").trim();
  const { rows } = await readTab("bills");
  const list = rows
    .filter((b) => !customerId || b.customerId === customerId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, customerId ? 200 : 500)
    .map((b) => ({ ...b, total: totals.get(b.no) || 0 }));
  res.status(200).json({ bills: list });
});
