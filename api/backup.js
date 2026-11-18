import { requireUser } from "../lib/auth.js";
import { allowMethods, handle } from "../lib/http.js";
import { copySheet, bangkokDate } from "../lib/backup.js";

// POST: make a full copy of sheet A right now, named with the time.
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["POST"])) return;
  const user = await requireUser(req);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const copy = await copySheet(`A-backup-${bangkokDate()}-manual-${stamp}`);
  console.info("manual backup by", user.email, copy.name);
  res.status(201).json({ ok: true, backup: copy });
});
