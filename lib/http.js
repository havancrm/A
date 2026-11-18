// Shared HTTP helpers: errors with status codes, method checks, and a wrapper that never leaks internals.
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "ไม่รองรับวิธีนี้" });
  return false;
}

export function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) {
        res.status(status).json({ error: status === 500 ? "เกิดข้อผิดพลาดภายในระบบ" : err.message });
      }
    }
  };
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  return {};
}
