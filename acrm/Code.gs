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
var BACKUP_DIR = '1jnhIsnNg1vDk4681qb7p7ruUDKLKRKYH';   // โฟลเดอร์ aCRM-Backup (สแนปชอตชีท A)
var SNAP_PREFIX = 'acrm-snapshot-';
var SNAP_KEEP = 30;                                     // เก็บสแนปชอตล่าสุดไว้ 30 ชุด ที่เกินจะย้ายไปถังขยะของ Drive
var RESTORE_SKIP = ['ACCESS', 'BACKUPS', 'changes', 'IMPORT_BATCHES'];  // ไม่กู้คืนแท็บสิทธิ์และแท็บบันทึก

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

function inBackupDir_(file) {
  var ps = file.getParents();
  while (ps.hasNext()) { if (ps.next().getId() === BACKUP_DIR) return true; }
  return false;
}
function snapFile_(id) {
  var f = DriveApp.getFileById(String(id));
  if (!inBackupDir_(f) || f.getName().indexOf(SNAP_PREFIX) !== 0) throw new Error('ไม่ใช่ไฟล์สแนปชอตในโฟลเดอร์สำรอง');
  return f;
}
function snapList_() {
  var it = DriveApp.getFolderById(BACKUP_DIR).getFiles(), L = [];
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (n.indexOf(SNAP_PREFIX) !== 0) continue;
    var d = {};
    try { d = JSON.parse(f.getDescription() || '{}'); } catch (e) {}
    L.push({ id: f.getId(), name: n, at: d.at || f.getDateCreated().toISOString(), reason: d.reason || '', url: f.getUrl() });
  }
  L.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  return L;
}
function snapPrune_() {
  var L = snapList_(), n = 0;
  for (var i = SNAP_KEEP; i < L.length; i++) { DriveApp.getFileById(L[i].id).setTrashed(true); n++; }
  return n;
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

    if (b.action === 'undobatch') {            // ยกเลิกชุดนำเข้าบิล: ลบเฉพาะบิลที่ stamp ตรงกับชุด + รายการสินค้าของบิลนั้น
      var stamp = String(b.stamp || ''), bid = String(b.batchId || '');
      if (!stamp || !bid) return out_({ ok: false, error: 'missing batch' });
      var meta = Sheets.Spreadsheets.get(SHEET_ID, { fields: 'sheets.properties' }).sheets;
      var idOf = function (n) { for (var i = 0; i < meta.length; i++) if (meta[i].properties.title === n) return meta[i].properties.sheetId; throw new Error('no sheet ' + n); };
      var del = function (name, rowsIdx) {      // ลบจากล่างขึ้นบน ทีละช่วงต่อเนื่อง
        var reqs = [], i = rowsIdx.length - 1;
        while (i >= 0) { var end = rowsIdx[i], st = end; while (i > 0 && rowsIdx[i - 1] === st - 1) { st = rowsIdx[--i]; } i--;
          reqs.push({ deleteDimension: { range: { sheetId: idOf(name), dimension: 'ROWS', startIndex: st, endIndex: end + 1 } } }); }
        if (reqs.length) Sheets.Spreadsheets.batchUpdate({ requests: reqs }, SHEET_ID);
      };
      var bills = (Sheets.Spreadsheets.Values.get(SHEET_ID, 'bills!A1:M').values || []), nos = {}, bi = [];
      for (var i = 1; i < bills.length; i++) if (String(bills[i][12] || '') === stamp) { nos[String(bills[i][0])] = 1; bi.push(i); }
      if (bi.length > 3000) return out_({ ok: false, error: 'too many rows' });
      var its = (Sheets.Spreadsheets.Values.get(SHEET_ID, 'bill_items!A1:A').values || []), ii = [];
      for (var j = 1; j < its.length; j++) if (nos[String(its[j][0] || '')]) ii.push(j);
      del('bill_items', ii); del('bills', bi);
      var bt = Sheets.Spreadsheets.Values.get(SHEET_ID, 'IMPORT_BATCHES!A1:A').values || [];
      for (var k = 1; k < bt.length; k++) if (String(bt[k][0]) === bid) { Sheets.Spreadsheets.Values.update({ values: [['undone']] }, SHEET_ID, 'IMPORT_BATCHES!H' + (k + 1), { valueInputOption: 'RAW' }); break; }
      return out_({ ok: true, bills: bi.length, items: ii.length, nos: Object.keys(nos) });
    }

    if (b.action === 'snapshot') {             // สำรองทั้งไฟล์ชีท A เป็นสำเนาเต็ม (ค่า สูตร รูปแบบ ครบ) เก็บในโฟลเดอร์ aCRM-Backup
      var reason = String(b.reason || 'manual').replace(/[^a-zA-Z0-9\-]/g, '') || 'manual';
      var name = SNAP_PREFIX + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss') + '-' + reason;
      var copy = DriveApp.getFileById(SHEET_ID).makeCopy(name, DriveApp.getFolderById(BACKUP_DIR));
      copy.setDescription(JSON.stringify({ reason: reason, at: new Date().toISOString(), by: String(b.user || '') }));
      return out_({ ok: true, id: copy.getId(), name: name, pruned: snapPrune_() });
    }

    if (b.action === 'snap_list') return out_({ ok: true, list: snapList_() });

    if (b.action === 'snap_trash') {           // ย้ายสแนปชอตที่เลือกไปถังขยะ (Drive เก็บในถังขยะ 30 วันแล้วลบเอง)
      snapFile_(b.id).setTrashed(true);
      return out_({ ok: true });
    }

    if (b.action === 'restore_tab') {          // คัดลอกแท็บจากสแนปชอตมาแทนแท็บจริง: สร้างสำเนาใหม่ก่อน แล้วค่อยลบของเดิมและตั้งชื่อใหม่
      var title = String(b.title || '');
      if (!title || RESTORE_SKIP.indexOf(title) > -1) throw new Error('แท็บ ' + title + ' ไม่อยู่ในรายการกู้คืน');
      var sf = snapFile_(b.snapshotId);
      var findTab = function (sid, t) {
        var ss = Sheets.Spreadsheets.get(sid, { fields: 'sheets.properties' }).sheets;
        for (var i = 0; i < ss.length; i++) if (ss[i].properties.title === t) return { id: ss[i].properties.sheetId, index: ss[i].properties.index };
        return null;
      };
      var src = findTab(sf.getId(), title), dst = findTab(SHEET_ID, title);
      if (!src) throw new Error('ไม่พบแท็บ ' + title + ' ในสแนปชอต');
      if (!dst) throw new Error('ไม่พบแท็บ ' + title + ' ในชีทจริง');
      var copied = Sheets.Spreadsheets.Sheets.copyTo({ destinationSpreadsheetId: SHEET_ID }, sf.getId(), src.id);
      Sheets.Spreadsheets.batchUpdate({ requests: [
        { deleteSheet: { sheetId: dst.id } },
        { updateSheetProperties: { properties: { sheetId: copied.sheetId, title: title, index: dst.index }, fields: 'title,index' } }
      ] }, SHEET_ID);
      return out_({ ok: true, title: title });
    }

    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
