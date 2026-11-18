// Checks the Google ID token sent by the browser, then looks the email up in the ACCESS tab.
import { OAuth2Client } from "google-auth-library";
import { readTab } from "./tabs.js";
import { cached } from "./cache.js";
import { httpError } from "./http.js";

const oauth = new OAuth2Client();

async function activeAccess() {
  return cached("access", 300_000, () => readTab("ACCESS"));
}

export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw httpError(401, "ต้องเข้าสู่ระบบก่อน");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID");

  let payload;
  try {
    const ticket = await oauth.verifyIdToken({ idToken: token, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw httpError(401, "การเข้าสู่ระบบหมดอายุ ให้ล็อกอินใหม่");
  }
  if (!payload.email_verified) throw httpError(403, "อีเมลนี้ยังไม่ได้ยืนยัน");

  const email = String(payload.email).trim().toLowerCase();
  const { rows } = await activeAccess();
  const row = rows.find(
    (r) => String(r.email || "").trim().toLowerCase() === email && String(r.active).toUpperCase() === "TRUE"
  );
  if (!row) throw httpError(403, "บัญชีนี้ยังไม่ได้รับสิทธิ์ ให้ผู้ดูแลเพิ่มในแท็บ ACCESS");
  return { email, role: (row.role || "sales").toLowerCase() };
}

export function requireAdmin(user) {
  if (user.role !== "admin") throw httpError(403, "เฉพาะผู้ดูแลระบบ");
}
