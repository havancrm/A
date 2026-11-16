/**
 * Field CRM — ตัวอ่านชีท A (อ่านอย่างเดียว ไม่แก้ไขข้อมูลในชีท)
 * วิธีใช้: เปิดชีท A → ส่วนขยาย → Apps Script → วางโค้ดนี้แทนของเดิม
 * 1) แก้ TOKEN เป็นรหัสลับของคุณเอง (ยาว ๆ เดายาก)
 * 2) ทำให้ใช้งาน → การทำให้ใช้งานใหม่ → ประเภท "เว็บแอป"
 *    ดำเนินการในฐานะ: ฉัน | ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน  (ข้อมูลยังถูกป้องกันด้วย TOKEN)
 * 3) คัดลอก URL ที่ลงท้าย /exec ไปวางในแอป (ตั้งค่า → เชื่อมชีท A) พร้อม TOKEN เดียวกัน
 */
const TOKEN = 'เปลี่ยนเป็นรหัสลับของคุณ';
const SHEETS = ['customers', 'customer_labels', 'bills', 'bill_items', 'products', 'visits', 'tasks'];

function doGet(e) {
  const p = e.parameter || {};
  if (!p.token || p.token !== TOKEN) return out({ error: 'unauthorized' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = {};
  SHEETS.forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() > 0) res[n] = sh.getDataRange().getDisplayValues();
  });
  // จำกัดบิลย้อนหลังตามจำนวนเดือนที่ขอ (ลดขนาดข้อมูล)
  const months = Number(p.months || 12);
  if (months > 0 && res.bills) {
    const c = new Date(); c.setMonth(c.getMonth() - months);
    const cut = Utilities.formatDate(c, 'Asia/Bangkok', 'yyyy-MM-dd');
    const head = res.bills[0], di = head.indexOf('date'), ni = head.indexOf('no');
    const keep = res.bills.filter(function (r, i) { return i === 0 || String(r[di]) >= cut; });
    const set = {}; keep.forEach(function (r, i) { if (i) set[r[ni]] = 1; });
    res.bills = keep;
    if (res.bill_items) res.bill_items = res.bill_items.filter(function (r, i) { return i === 0 || set[r[0]]; });
  }
  return out(res);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
