// Public values the browser needs to start Google sign-in. No secrets here.
import { allowMethods, handle } from "../lib/http.js";

export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET"])) return;
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
});
