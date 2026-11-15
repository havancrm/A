/**
 * Nightly backup of CRM data from Firestore to Google Drive (Apps Script).
 *
 * Setup (one time, by the account that owns the backup folder):
 *  1. script.google.com > New project > paste this file.
 *  2. Project Settings > Script properties, add:
 *       FIREBASE_PROJECT_ID   = the Firebase project id
 *       SERVICE_ACCOUNT_JSON  = the full JSON key of a service account that has
 *                               the "Cloud Datastore User" role (read-only use)
 *  3. Run backupNow() once and approve the permissions.
 *  4. Triggers > Add trigger > backupNow > Time-driven > Day timer (e.g. 02:00-03:00).
 *
 * Output: one JSON file per day in the CRM-Backups folder, named crm-backup-YYYY-MM-DD.json.
 * Files older than RETENTION_DAYS are moved to trash.
 */

var BACKUP_FOLDER_ID = "1F1ESrA_oMYfR-08AL2FDzMaJmlAT6I3N"; // CRM-Backups in havan.crm@gmail.com
var RETENTION_DAYS = 30;
var COLLECTIONS = ["customers", "visits", "tasks", "orders", "settings"]; // adjust to the Firestore schema

function backupNow() {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("Missing script property FIREBASE_PROJECT_ID");
  var token = getAccessToken_(JSON.parse(props.getProperty("SERVICE_ACCOUNT_JSON")));

  var dump = { exportedAt: new Date().toISOString(), collections: {} };
  COLLECTIONS.forEach(function (name) {
    dump.collections[name] = listDocuments_(projectId, name, token);
  });

  var day = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  var folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  var fileName = "crm-backup-" + day + ".json";
  var existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true); // same-day rerun replaces the file
  folder.createFile(fileName, JSON.stringify(dump), MimeType.PLAIN_TEXT);

  pruneOldBackups_(folder);
}

function listDocuments_(projectId, collection, token) {
  var url = "https://firestore.googleapis.com/v1/projects/" + projectId +
            "/databases/(default)/documents/" + collection + "?pageSize=300";
  var out = [], pageToken = null;
  do {
    var res = UrlFetchApp.fetch(url + (pageToken ? "&pageToken=" + pageToken : ""), {
      headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error("Firestore " + collection + ": " + res.getContentText());
    var body = JSON.parse(res.getContentText());
    (body.documents || []).forEach(function (d) { out.push(d); });
    pageToken = body.nextPageToken || null;
  } while (pageToken);
  return out;
}

function pruneOldBackups_(folder) {
  var cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (/^crm-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName()) && f.getDateCreated() < cutoff) {
      f.setTrashed(true);
    }
  }
}

// Service-account OAuth token via JWT (no external libraries).
function getAccessToken_(key) {
  var now = Math.floor(Date.now() / 1000);
  var header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/datastore.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  }));
  var unsigned = header + "." + claim;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(unsigned, key.private_key));
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error("Token error: " + res.getContentText());
  return JSON.parse(res.getContentText()).access_token;
}
