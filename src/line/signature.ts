/** Verify raw bytes with Web Crypto rather than comparing secret-derived strings. */
export async function verifyLineSignature(rawBody: ArrayBuffer, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  try {
    const bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, bytes, rawBody);
  } catch {
    return false;
  }
}
