import { createHmac, createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createState } from '../src/domain/state';
import { MemoryKV } from './support/memory-kv';

const secret = 'test-hmac-secret';
const user = 'test-line-user';
it('stores only the last route with HMAC user key and 30-minute expiration', async () => {
  const kv = new MemoryKV();
  const state = createState(kv, secret, () => 1000);
  expect(await state.putLastRouteId(user, 'first_aid.root')).toBe(true);
  const write = kv.writes[0];
  expect(write?.key).toBe('context:' + createHmac('sha256', secret).update(user).digest('hex'));
  expect(write?.ttl).toBe(1800);
  expect(JSON.parse(write?.value ?? '')).toEqual({lastRouteId:'first_aid.root', expiresAt:1801000});
  expect(JSON.stringify(kv.writes)).not.toContain(user);
  expect(await createState(kv, secret, () => 1000).getLastRouteId(user)).toBe('first_aid.root');
});
it('rejects expired context even if a stale KV value remains visible', async () => {
  const kv = new MemoryKV();
  await createState(kv, secret, () => 1000).putLastRouteId(user, 'first_aid.root');
  expect(await createState(kv, secret, () => 1801000).getLastRouteId(user)).toBeNull();
});
it.each(['not JSON', '{"lastRouteId":12,"expiresAt":1801000}', '{"lastRouteId":"first_aid.root"}', '{"lastRouteId":"first_aid.root","expiresAt":999999999}'])('ignores malformed context %s', async value => {
  const kv = new MemoryKV();
  const key = 'context:' + createHmac('sha256', secret).update(user).digest('hex');
  kv.values.set(key, value);
  expect(await createState(kv, secret, () => 1000).getLastRouteId(user)).toBeNull();
});
it('stores a hashed event ID with 24-hour expiration after marking success', async () => {
  const kv = new MemoryKV(); const state = createState(kv, secret, () => 1000);
  expect(await state.hasReplied('test-event-id')).toBe(false);
  expect(await state.markReplied('test-event-id')).toBe(true);
  expect(kv.writes[0]?.key).toBe('event:' + createHash('sha256').update('test-event-id').digest('hex'));
  expect(kv.writes[0]?.ttl).toBe(86400);
  expect(await createState(kv, secret, () => 1000).hasReplied('test-event-id')).toBe(true);
  expect(await createState(kv, secret, () => 86401000).hasReplied('test-event-id')).toBe(false);
});
it('clears context when explicitly reset', async () => {
  const kv = new MemoryKV(); const state = createState(kv, secret);
  await state.putLastRouteId(user, 'first_aid.root');
  expect(await state.clearLastRouteId(user)).toBe(true);
  expect(await createState(kv, secret).getLastRouteId(user)).toBeNull();
});
it('isolates users and replaces the previous topic', async () => {
  const kv = new MemoryKV(); const state = createState(kv, secret);
  await state.putLastRouteId(user, 'first_aid.root');
  await state.putLastRouteId('another-user', 'lab.source.ic04');
  await state.putLastRouteId(user, 'first_aid.eye');
  expect(await state.getLastRouteId(user)).toBe('first_aid.eye');
  expect(await state.getLastRouteId('another-user')).toBe('lab.source.ic04');
});
it('falls back safely on get, put and delete errors', async () => {
  const kv = new MemoryKV(); const state = createState(kv, secret);
  kv.failRead = kv.failWrite = kv.failDelete = true;
  expect(await state.getLastRouteId(user)).toBeNull();
  expect(await state.putLastRouteId(user, 'first_aid.root')).toBe(false);
  expect(await state.clearLastRouteId(user)).toBe(false);
  expect(await state.hasReplied('test-event')).toBe(false);
  expect(await state.markReplied('test-event')).toBe(false);
});
it('attempts to invalidate old context after a failed topic write', async () => {
  const kv = new MemoryKV(); const state = createState(kv, secret);
  await state.putLastRouteId(user, 'first_aid.root');
  kv.failContextWrite = true;
  expect(await state.putLastRouteId(user, 'lab.source.ic04')).toBe(false);
  expect(kv.deleted).toHaveLength(1);
  expect(await createState(kv, secret).getLastRouteId(user)).toBeNull();
});
it('works without KV or a HMAC secret without using raw identifiers', async () => {
  expect(await createState(undefined, secret).getLastRouteId(user)).toBeNull();
  const kv = new MemoryKV();
  expect(await createState(kv, undefined).putLastRouteId(user, 'first_aid.root')).toBe(false);
  expect(kv.writes).toHaveLength(0);
});
it('suppresses duplicates in the current request even if marking KV fails', async () => {
  const kv = new MemoryKV(); kv.failWrite = true;
  const state = createState(kv, secret, () => 1000);
  expect(await state.markReplied('event')).toBe(false);
  expect(await state.hasReplied('event')).toBe(true);
  // A different request cannot rely on this request-local cache.
  expect(await createState(kv, secret, () => 1000).hasReplied('event')).toBe(false);
});
it.each(['not JSON', '{}', '{"expiresAt":999999999}', '{"expiresAt":1000}'])('ignores invalid event markers %s', async value => {
  const kv = new MemoryKV();
  kv.values.set('event:' + createHash('sha256').update('event').digest('hex'), value);
  expect(await createState(kv, secret, () => 1000).hasReplied('event')).toBe(false);
});
it('uses request-local context rather than a stale read after updating topic', async () => {
  const kv = new MemoryKV(); kv.get = async () => null;
  const state = createState(kv, secret, () => 1000);
  await state.putLastRouteId(user, 'first_aid.root');
  expect(await state.getLastRouteId(user)).toBe('first_aid.root');
  await state.clearLastRouteId(user);
  expect(await state.getLastRouteId(user)).toBeNull();
});
