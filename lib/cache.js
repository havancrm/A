// Small in-memory TTL cache. Each serverless instance keeps its own copy; a miss only costs one Sheets read.
const store = new Map();

export async function cached(key, ttlMs, load) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function bust(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
