import { requireUser } from "../lib/auth.js";
import { allowMethods, handle } from "../lib/http.js";

export default handle(async (req, res) => {
  if (!allowMethods(req, res, ["GET"])) return;
  const user = await requireUser(req);
  res.status(200).json(user);
});
