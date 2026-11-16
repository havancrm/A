/**
 * aCRM  <->  Google Sheet A   (Apps Script Web App)
 *
 * ติดตั้ง (ครั้งเดียว)
 * 1) เปิดชีต A > Extensions > Apps Script > วางโค้ดนี้ทับของเดิม
 * 2) เมนูซ้าย "Services" (+) > เลือก "Google Sheets API" > Add   (ต้องเปิด เพื่อเขียนค่าแบบ RAW ไม่ให้เลขศูนย์หน้าเบอร์/รหัสหาย)
 * 3) (ไม่บังคับ) Project Settings > Script properties > เพิ่ม API_TOKEN ถ้าอยากมีรหัสกันคนอื่น · ไม่ตั้ง = ไม่ใช้รหัส
 * 4) Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone > Deploy (กดอนุญาตสิทธิ์)
 * 5) คัดลอก URL ที่ลงท้าย /exec ไปใส่ในแอป: ตั้งค่า > เชื่อมชีต A
 *
 * แก้โค้ดแล้วต้อง Deploy > Manage deployments > Edit > New version ทุกครั้ง
 */
var SHEET_ID = '1EBE-eNNO-6gBA4QROfL7mu4WUOJlm_ID5OqktqUERPo';
var PHOTO_DIR = '1Y0yavF8RJg7siSzW6qdl3_G-ou1Cglcb';

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function authOk_(t) {
  var k = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!k) return true;                 // ไม่ได้ตั้ง API_TOKEN = ไม่ตรวจรหัส (ใครมี URL ก็ใช้ได้)
  return t === k;
}
function sheetOf_(range) {            // "customers!A:A" หรือ "'my tab'!A1:B2" -> ชื่อแท็บ
  var m = String(range).match(/^'?([^'!]+)'?!/);
  return m ? m[1] : String(range);
}
function mustExist_(name) {
  if (!SpreadsheetApp.openById(SHEET_ID).getSheetByName(name)) throw new Error('ไม่พบแท็บ ' + name);
}

function doGet(e) {
  var ok = e && e.parameter && authOk_(e.parameter.token);
  return out_(ok ? { ok: true, pong: new Date().toISOString() } : { ok: false, error: 'unauthorized' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var b = JSON.parse(e.postData.contents);
    if (!authOk_(b.token)) return out_({ ok: false, error: 'unauthorized' });

    if (b.action === 'ping') return out_({ ok: true });

    if (b.action === 'get') {
      mustExist_(sheetOf_(b.range));
      var r = Sheets.Spreadsheets.Values.get(SHEET_ID, b.range);
      return out_({ ok: true, values: r.values || [] });
    }

    lock.waitLock(25000);

    if (b.action === 'append') {
      mustExist_(b.sheet);
      var rows = b.rows || [];
      if (rows.length) {
        Sheets.Spreadsheets.Values.append({ values: rows }, SHEET_ID, b.sheet + '!A1',
          { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
      }
      return out_({ ok: true, added: rows.length });
    }

    if (b.action === 'update') {
      mustExist_(sheetOf_(b.range));
      Sheets.Spreadsheets.Values.update({ values: b.rows || [] }, SHEET_ID, b.range, { valueInputOption: 'RAW' });
      return out_({ ok: true });
    }

    if (b.action === 'photo') {
      var blob = Utilities.newBlob(Utilities.base64Decode(b.base64), b.mime || 'image/jpeg', b.name || ('P-' + Date.now() + '.jpg'));
      var f = DriveApp.getFolderById(b.folder || PHOTO_DIR).createFile(blob);
      return out_({ ok: true, id: f.getId() });
    }

    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
