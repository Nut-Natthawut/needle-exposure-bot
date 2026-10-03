import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyLineSignature } from '../src/line/signature';

const secret = 'test-channel-secret';
const raw = '{ "events": [], "thai": "เข็มทิ่มตำ\\n" }';
const sign = (body: string) => createHmac('sha256', secret).update(body).digest('base64');
const bytes = (body: string): ArrayBuffer => new Uint8Array(new TextEncoder().encode(body)).buffer;
it('verifies HMAC over the untouched UTF-8 request bytes', async () => {
  expect(await verifyLineSignature(bytes(raw), sign(raw), secret)).toBe(true);
});
it('rejects a one-byte change after signing', async () => {
  expect(await verifyLineSignature(bytes(raw + ' '), sign(raw), secret)).toBe(false);
});
it('rejects reserialization even when the JSON meaning is unchanged', async () => {
  expect(await verifyLineSignature(bytes(JSON.stringify(JSON.parse(raw))), sign(raw), secret)).toBe(false);
});
it.each([null, '', 'bad!', 'a'.repeat(44), 'YQ=='])('rejects missing or malformed signature %s', async signature => {
  expect(await verifyLineSignature(bytes(raw), signature, secret)).toBe(false);
});
it('rejects a different channel secret', async () => {
  expect(await verifyLineSignature(bytes(raw), sign(raw), 'wrong-channel')).toBe(false);
});
