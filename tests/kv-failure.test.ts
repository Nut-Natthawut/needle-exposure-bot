import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { createWebhookHandler } from '../src/index';
import { createState } from '../src/domain/state';
import { MemoryKV } from './support/memory-kv';
import ui from '../content/ui.json';
import routes from '../content/routes.json';

function setup() {
  const kv = new MemoryKV();
  const env = {LINE_CHANNEL_SECRET:'test-channel', LINE_CHANNEL_ACCESS_TOKEN:'test-access', HMAC_SECRET:'test-hmac', STATE_KV:kv};
  const sent: {messages: {text:string}[]}[] = [];
  let now = 1000;
  let replyStatus = 200;
  const handle = createWebhookHandler(async (_url, init) => {sent.push(JSON.parse(String(init.body))); return new Response('{}', {status:replyStatus});}, () => now);
  async function send(value: string, eventId: string, kind = 'text') {
    const e = {type:kind === 'text' ? 'message':'postback', replyToken:'test-reply', source:{type:'user',userId:'test-user'}, webhookEventId:eventId,
      ...(kind === 'text' ? {message:{type:'text',text:value}} : {postback:{data:value}})};
    const body = JSON.stringify({events:[e]});
    const signature = createHmac('sha256', env.LINE_CHANNEL_SECRET).update(body).digest('base64');
    return handle(new Request('https://test.invalid/webhook', {method:'POST',headers:{'x-line-signature':signature},body}), env);
  }
  return {kv, env, sent, send, setNow:(value:number) => {now=value;}, setReplyStatus:(value:number) => {replyStatus=value;}};
}
it('remembers the latest route for a follow-up then expires after 30 minutes', async () => {
  const x = setup();
  await x.send('การเจาะเลือด','one'); await x.send('ผลบวก','two');
  expect(x.sent[1]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'lab.source.positive')?.text);
  x.setNow(1801000); await x.send('ในเวลา','three');
  expect(x.sent[2]?.messages[0]?.text).toBe(ui.missingContext);
});
it('does not reply again to an already successful event', async () => {
  const x = setup(); await x.send('เลือดเข้าตา','same'); await x.send('เลือดเข้าตา','same');
  expect(x.sent).toHaveLength(1);
});
it('does not mark an event successful when Reply API fails', async () => {
  const x = setup(); x.setReplyStatus(500);
  expect((await x.send('เลือดเข้าตา','same')).status).toBe(502);
  expect(x.kv.writes).toHaveLength(0);
  x.setReplyStatus(200); await x.send('เลือดเข้าตา','same');
  expect(x.sent).toHaveLength(2);
});
it('updates topic after a new postback and resets explicitly', async () => {
  const x = setup(); await x.send('การเจาะเลือด','one'); await x.send('first_aid.root','two','postback'); await x.send('เข้าตา','three');
  expect(x.sent[2]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'first_aid.eye')?.text);
  await x.send('เริ่มใหม่','four'); await x.send('เข้าตา','five');
  expect(x.sent[3]?.messages[0]?.text).toBe(ui.reset);
  expect(x.sent[4]?.messages[0]?.text).toBe(ui.missingContext);
});
it('clears old topic after an ambiguous new question', async () => {
  const x = setup(); await x.send('การเจาะเลือด','one'); await x.send('PEP','two'); await x.send('ผลบวก','three');
  expect(x.sent[2]?.messages[0]?.text).toBe(ui.missingContext);
});
it('direct routes still reply when KV reads and writes fail', async () => {
  const x = setup(); x.kv.failRead=x.kv.failWrite=x.kv.failDelete=true;
  expect((await x.send('first_aid.eye','one','postback')).status).toBe(200);
  expect(x.sent[0]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'first_aid.eye')?.text);
  expect((await x.send('ผลบวก','two')).status).toBe(200);
  expect(x.sent[1]?.messages[0]?.text).toBe(ui.missingContext);
});
it('KV rate-limit on a topic change does not block reply or retain old readable context', async () => {
  const x = setup(); await x.send('การเจาะเลือด','one'); x.kv.failContextWrite=true;
  expect((await x.send('first_aid.root','two','postback')).status).toBe(200);
  await x.send('ผลบวก','three');
  expect(x.sent[2]?.messages[0]?.text).toBe(ui.missingContext);
});
it('markReplied failure never turns a delivered reply into a webhook error', async () => {
  const x = setup(); x.kv.failWrite=true;
  expect((await x.send('เลือดเข้าตา','one')).status).toBe(200);
  expect(x.sent).toHaveLength(1);
});
it('does not read or write KV before signature verification', async () => {
  const x = setup(); let reads=0;
  x.kv.get=async () => {reads++; throw new Error('should not be read');};
  const response = await createWebhookHandler()(new Request('https://test.invalid/webhook', {method:'POST',headers:{'x-line-signature':'bad'},body:'not JSON'}), x.env);
  expect(response.status).toBe(401); expect(reads).toBe(0); expect(x.kv.writes).toHaveLength(0);
});
it('context storage contains no user ID or question text', async () => {
  const x = setup(); await x.send('เลือดเข้าตา','one');
  const stored=JSON.stringify(x.kv.writes);
  expect(stored).not.toContain('test-user'); expect(stored).not.toContain('เลือดเข้าตา');
  expect(await createState(x.kv,x.env.HMAC_SECRET,()=>1000).getLastRouteId('test-user')).toBe('first_aid.eye');
});
it('handles duplicate events and follow-ups within one signed batch despite stale KV reads', async () => {
  const x = setup(); x.kv.get = async () => null;
  const event = (text:string, id:string) => ({type:'message',replyToken:'test-reply',webhookEventId:id,
    source:{type:'user',userId:'test-user'},message:{type:'text',text}});
  const body = JSON.stringify({events:[event('การเจาะเลือด','one'),event('การเจาะเลือด','one'),event('ผลบวก','two')]});
  const signature = createHmac('sha256', x.env.LINE_CHANNEL_SECRET).update(body).digest('base64');
  const handle = createWebhookHandler(async (_url, init) => {x.sent.push(JSON.parse(String(init.body))); return new Response('{}');}, () => 1000);
  expect((await handle(new Request('https://test.invalid/webhook', {method:'POST',headers:{'x-line-signature':signature},body}), x.env)).status).toBe(200);
  expect(x.sent).toHaveLength(2);
  expect(x.sent[1]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'lab.source.positive')?.text);
});
