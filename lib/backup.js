// Backups are full copies of sheet A made with the Drive API into BACKUP_FOLDER_ID.
import { driveApi, sheetId } from "./google.js";
import { cached } from "./cache.js";
import { httpError } from "./http.js";

export function bangkokDate(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function folderId() {
  const id = process.env.BACKUP_FOLDER_ID;
  if (!id) throw httpError(500, "ยังไม่ได้ตั้ง BACKUP_FOLDER_ID");
  return id;
}

export async function copySheet(name) {
  const res = await driveApi().files.copy({
    fileId: sheetId(),
    requestBody: { name, parents: [folderId()] },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });
  return { id: res.data.id, name: res.data.name, link: res.data.webViewLink || null };
}

// Makes at most one automatic backup per Bangkok day. Checked at most every 10 minutes per instance.
export function ensureDailyBackup() {
  const day = bangkokDate();
  return cached("backup:" + day, 600_000, async () => {
    const name = "A-backup-" + day;
    const list = await driveApi().files.list({
      q: `'${folderId()}' in parents and name = '${name}' and trashed = false`,
      fields: "files(id,name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (list.data.files && list.data.files.length) return { created: false, name };
    const copy = await copySheet(name);
    return { created: true, name: copy.name };
  });
}
