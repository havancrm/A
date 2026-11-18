// Google clients. Credentials come from Vercel environment variables, never from the repo.
import { google } from "googleapis";

let authClient;

export function getAuth() {
  if (!authClient) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("ยังไม่ได้ตั้ง GOOGLE_SERVICE_ACCOUNT_JSON");
    authClient = new google.auth.GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }
  return authClient;
}

export function sheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้ง SHEET_ID");
  return id;
}

export function sheetsApi() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function driveApi() {
  return google.drive({ version: "v3", auth: getAuth() });
}
