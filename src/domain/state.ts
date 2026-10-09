/** Minimal storage boundary; also implemented by Cloudflare KVNamespace. */
export interface StateKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: {expirationTtl: number}): Promise<void>;
  delete(key: string): Promise<void>;
}

const CONTEXT_TTL = 1800;
const EVENT_TTL = 86400;
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createState(kv: StateKV | undefined, secret: string | undefined, now = Date.now) {
  // These caches live for one webhook request only, never across users/requests.
  const contexts = new Map<string, {lastRouteId: string; expiresAt: number} | null>();
  const replied = new Map<string, number>();
  let hmacKey: Promise<CryptoKey> | undefined;
  async function contextKey(userId: string): Promise<string | null> {
    if (!secret || !userId) return null;
    hmacKey ??= crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
    return 'context:' + hex(await crypto.subtle.sign('HMAC', await hmacKey, encoder.encode(userId)));
  }
  async function eventKey(eventId: string): Promise<string> {
    return 'event:' + hex(await crypto.subtle.digest('SHA-256', encoder.encode(eventId)));
  }
  function validExpiration(value: unknown, ttl: number): value is {expiresAt: number} {
    if (typeof value !== 'object' || value === null || !('expiresAt' in value)) return false;
    return typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
      && value.expiresAt > now() && value.expiresAt <= now() + ttl * 1000;
  }
  async function clearLastRouteId(userId: string): Promise<boolean> {
    contexts.set(userId, null);
    try {
      const key = await contextKey(userId);
      if (!kv || !key) return false;
      await kv.delete(key);
      return true;
    } catch {return false;}
  }
  return {
    async getLastRouteId(userId: string): Promise<string | null> {
      try {
        if (contexts.has(userId)) {
          const cached = contexts.get(userId);
          return cached && validExpiration(cached, CONTEXT_TTL) ? cached.lastRouteId : null;
        }
        const key = await contextKey(userId);
        if (!kv || !key) return null;
        const raw = await kv.get(key);
        const value: unknown = raw === null ? null : JSON.parse(raw);
        if (!validExpiration(value, CONTEXT_TTL) || !('lastRouteId' in value)
          || typeof value.lastRouteId !== 'string' || !value.lastRouteId) return null;
        contexts.set(userId, {lastRouteId:value.lastRouteId, expiresAt:value.expiresAt});
        return value.lastRouteId;
      } catch {return null;}
    },
    async putLastRouteId(userId: string, routeId: string): Promise<boolean> {
      try {
        const key = await contextKey(userId);
        if (!kv || !key || !routeId) return false;
        const value = {lastRouteId:routeId, expiresAt:now() + CONTEXT_TTL * 1000};
        await kv.put(key, JSON.stringify(value), {expirationTtl:CONTEXT_TTL});
        contexts.set(userId, value);
        return true;
      } catch {
        // Avoid intentionally retaining an older topic after a failed replacement.
        // KV eventual consistency means invalidation is still best effort.
        await clearLastRouteId(userId);
        return false;
      }
    },
    clearLastRouteId,
    async hasReplied(eventId: string | undefined): Promise<boolean> {
      if (!eventId) return false;
      if ((replied.get(eventId) ?? 0) > now()) return true;
      try {
        if (!kv) return false;
        const raw = await kv.get(await eventKey(eventId));
        const value: unknown = raw === null ? null : JSON.parse(raw);
        return validExpiration(value, EVENT_TTL);
      } catch {return false;}
    },
    async markReplied(eventId: string | undefined): Promise<boolean> {
      if (!eventId) return false;
      const expiresAt = now() + EVENT_TTL * 1000;
      replied.set(eventId, expiresAt);
      try {
        if (!kv) return false;
        await kv.put(await eventKey(eventId), JSON.stringify({expiresAt}), {expirationTtl:EVENT_TTL});
        return true;
      } catch {return false;}
    },
  };
}
