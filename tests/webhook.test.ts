import { createHmac } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createWebhookHandler } from '../src/index';
import routes from '../content/routes.json';
import ui from '../content/ui.json';
import type { Fetcher } from '../src/line/reply';

const env = {LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-access-token'};
const event = () => ({type:'message', timestamp: 1, webhookEventId:'test-event', deliveryContext:{isRedelivery:false}, source:{type:'user', userId:'test-user'}, replyToken:'test-reply-token', message:{id:'test-message', type:'text', text:'เลือดเข้าตา'}});
const received: {replyToken: string; messages: {type: string; text: string}[]}[] = [];
let status = 200;
const fetcher: Fetcher = async (_url, init) => { received.push(JSON.parse(String(init.body))); return new Response('{}', {status}); };
const handle = createWebhookHandler(fetcher);
function request(body: string, signature = createHmac('sha256', env.LINE_CHANNEL_SECRET).update(body).digest('base64')) {
  return new Request('https://test.invalid/webhook', {method:'POST', headers:{'x-line-signature':signature}, body});
}
beforeEach(() => {received.length = 0; status = 200;});
it('accepts a signed empty verification request without calling LINE', async () => {
  expect((await handle(request('{"events":[]}'), env)).status).toBe(200);
  expect(received).toHaveLength(0);
});
it('routes a signed text event and replies with unchanged corpus text', async () => {
  expect((await handle(request(JSON.stringify({events:[event()]})), env)).status).toBe(200);
  expect(received).toHaveLength(1);
  expect(received[0]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'first_aid.eye')?.text);
});
it('routes a signed 1:1 postback', async () => {
  const e = {...event(), type:'postback', postback:{data:'first_aid.mouth'}};
  expect((await handle(request(JSON.stringify({events:[e]})), env)).status).toBe(200);
  expect(received[0]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'first_aid.mouth')?.text);
});
it('welcomes a 1:1 follow event from fixed UI copy', async () => {
  expect((await handle(request(JSON.stringify({events:[{...event(), type:'follow'}]})), env)).status).toBe(200);
  expect(received[0]?.messages[0]?.text).toBe(ui.welcome);
});
it.each(['group', 'room'])('ignores %s source with no reply', async type => {
  const e = {...event(), source:{type, groupId:'test-group'}};
  expect((await handle(request(JSON.stringify({events:[e]})), env)).status).toBe(200);
  expect(received).toHaveLength(0);
});
it.each(['image', 'file', 'audio'])('ignores unsupported %s message with no clinical reply', async type => {
  const e = {...event(), message:{type,id:'test-message'}};
  expect((await handle(request(JSON.stringify({events:[e]})), env)).status).toBe(200);
  expect(received).toHaveLength(0);
});
it('rejects tampered body before parsing even when it is invalid JSON', async () => {
  expect((await handle(request('not JSON', 'invalid'), env)).status).toBe(401);
  expect(received).toHaveLength(0);
});
it('rejects a missing signature without sending a reply', async () => {
  const req = request(JSON.stringify({events:[event()]})); req.headers.delete('x-line-signature');
  expect((await handle(req, env)).status).toBe(401);
  expect(received).toHaveLength(0);
});
it('rejects signed malformed JSON without a reply', async () => {
  expect((await handle(request('not JSON'), env)).status).toBe(400);
  expect(received).toHaveLength(0);
});
it('rejects invalid event envelope', async () => {
  expect((await handle(request('{"events":{}}'), env)).status).toBe(400);
});
it('returns non-2xx when LINE rejects a reply', async () => {
  status = 500;
  expect((await handle(request(JSON.stringify({events:[event()]})), env)).status).toBe(502);
});
it('returns non-2xx when reply network request fails', async () => {
  const fail = createWebhookHandler(async () => {throw new Error('secret/private body');});
  const response = await fail(request(JSON.stringify({events:[event()]})), env);
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('private');
});
it('returns a generic configuration failure without secrets', async () => {
  expect((await handle(request('{"events":[]}'), {...env, LINE_CHANNEL_SECRET:''})).status).toBe(503);
  expect(received).toHaveLength(0);
});
it('acknowledges malformed or non-repliable events without replying', async () => {
  expect((await handle(request(JSON.stringify({events:[null, {type:'message'}, {...event(),replyToken:''}]})), env)).status).toBe(200);
  expect(received).toHaveLength(0);
});
it('restricts path and method', async () => {
  expect((await handle(new Request('https://test.invalid/'), env)).status).toBe(404);
  expect((await handle(new Request('https://test.invalid/webhook'), env)).status).toBe(405);
});
it('limits request body size before parsing or replying', async () => {
  expect((await handle(request('x'.repeat(256 * 1024 + 1)), env)).status).toBe(413);
  expect(received).toHaveLength(0);
});
it('preserves clinical text and adds a separate partial-content warning', async () => {
  const e = {...event(), message:{id:'test',type:'text',text:'การเจาะเลือด'}};
  expect((await handle(request(JSON.stringify({events:[e]})), env)).status).toBe(200);
  expect(received[0]?.messages[0]?.text).toBe(routes.find(r => r.routeId === 'lab.source.ic04')?.text);
  expect(received[0]?.messages[1]?.text).toBe(ui.partialContent);
});
it('never writes raw question or credentials to application logs on reply failure', async () => {
  const logs = [vi.spyOn(console, 'log').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})];
  try {
    status = 500;
    const e = {...event(), message:{id:'test',type:'text',text:'HN 12345 ชื่อทดสอบ'}};
    const response = await handle(request(JSON.stringify({events:[e]})), env);
    expect(response.status).toBe(502);
    const emitted = JSON.stringify(logs.flatMap(log => log.mock.calls));
    expect(emitted).not.toContain('HN 12345');
    expect(emitted).not.toContain(env.LINE_CHANNEL_SECRET);
    expect(emitted).not.toContain(env.LINE_CHANNEL_ACCESS_TOKEN);
    expect(emitted).not.toContain('test-reply-token');
  } finally {logs.forEach(log => log.mockRestore());}
});
it.each([400, 401, 429])('diagnostic reports the upstream HTTP %i rather than only webhook 502', async upstreamStatus => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const handler = createWebhookHandler(async () => new Response('private response body', {status:upstreamStatus}));
    const e = {...event(), message:{id:'test',type:'text',text:'HN 12345 ชื่อทดสอบ'}};
    const response = await handler(request(JSON.stringify({events:[e]})), {...env, REPLY_DIAGNOSTICS:'enabled'});
    expect(response.status).toBe(502);
    expect(log.mock.calls).toEqual([['[DEBUG-reply-502]', JSON.stringify({code:'http_error', status:upstreamStatus})]]);
    const emitted = JSON.stringify(log.mock.calls);
    for (const privateValue of ['private response body', 'HN 12345', env.LINE_CHANNEL_SECRET, env.LINE_CHANNEL_ACCESS_TOKEN, 'test-user', 'test-reply-token', 'test-event']) {
      expect(emitted).not.toContain(privateValue);
    }
  } finally {log.mockRestore();}
});
it('diagnostic distinguishes network failure without logging exception text', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const handler = createWebhookHandler(async () => {throw new Error('private access token');});
    expect((await handler(request(JSON.stringify({events:[event()]})), {...env, REPLY_DIAGNOSTICS:'enabled'})).status).toBe(502);
    expect(log.mock.calls).toEqual([['[DEBUG-reply-502]', '{"code":"network_error","status":null}']]);
  } finally {log.mockRestore();}
});
it('diagnostic distinguishes local validation failure before HTTP', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const response = await handle(request(JSON.stringify({events:[event()]})), {...env, LINE_CHANNEL_ACCESS_TOKEN:'', REPLY_DIAGNOSTICS:'enabled'});
    expect(response.status).toBe(502);
    expect(received).toHaveLength(0);
    expect(log.mock.calls).toEqual([['[DEBUG-reply-502]', '{"code":"invalid_request","status":null}']]);
  } finally {log.mockRestore();}
});
it('does not emit diagnostic on a successful reply', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect((await handle(request(JSON.stringify({events:[event()]})), {...env, REPLY_DIAGNOSTICS:'enabled'})).status).toBe(200);
    expect(log.mock.calls).toEqual([]);
  } finally {log.mockRestore();}
});
it('keeps diagnostic disabled unless explicitly enabled', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    status = 401;
    expect((await handle(request(JSON.stringify({events:[event()]})), env)).status).toBe(502);
    expect(log.mock.calls).toEqual([]);
  } finally {log.mockRestore();}
});
