# Firebase setup (project acrm-havan)

Free plan only (Spark). No Cloud Functions are used.

## Steps in the console (done by the owner)
1. Firestore Database: create in `asia-southeast1`, production mode.
2. Authentication: enable the Google sign-in provider.
3. Hosting: enable.
4. Create the document `config/access` with two fields:
   - `emails` (array of strings): every seller and manager allowed in
   - `admins` (array of strings): managers (informational for now)
5. Upload the rules: paste `firestore.rules` into Firestore > Rules, then Publish.

## Hosting
Only the app page is published. The `data/` folder (customer data) is never uploaded.
Copy `crm/index.html` into `hosting/` before deploying. Do not copy `data.js` there.

## Backup
`../backup/backup.gs` runs on Apps Script with a service account key. Keep the key out of the repo.
