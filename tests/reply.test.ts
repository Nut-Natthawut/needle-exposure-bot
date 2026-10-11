import { expect, it } from 'vitest';
import { reply, type Fetcher } from '../src/line/reply';
import { renderRoute } from '../src/line/render';
import routes from '../content/routes.json';

it('sends the actual Reply API request with bearer authentication and fixed text', async () => {
  const requests: {url: string; init: RequestInit}[] = [];
  const fetcher: Fetcher = async (url, init) => {
    requests.push({url, init}); return new Response('{}', {status: 200});
  };
  const result = await reply('test-reply-token', [{type: 'text', text: 'ข้อความจาก JSON'}], 'test-access-token', fetcher);
  expect(result).toEqual({ok: true});
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe('https://api.line.me/v2/bot/message/reply');
  expect(requests[0]?.init.method).toBe('POST');
  expect(requests[0]?.init.headers).toEqual({'Content-Type': 'application/json', Authorization: 'Bearer test-access-token'});
  expect(JSON.parse(String(requests[0]?.init.body))).toEqual({replyToken: 'test-reply-token', messages: [{type: 'text', text: 'ข้อความจาก JSON'}]});
});
it('returns an HTTP failure code without exposing the response body', async () => {
  const result = await reply('test', [{type:'text', text:'test'}], 'test', async () => new Response('private message details', {status: 429}));
  expect(result).toEqual({ok: false, code: 'http_error', status: 429});
});
it('returns network failures without exposing tokens or exception messages', async () => {
  const result = await reply('test', [{type:'text', text:'test'}], 'test', async () => {throw new Error('private token');});
  expect(result).toEqual({ok: false, code: 'network_error'});
});
it('does not attempt HTTP when required credentials are absent', async () => {
  let calls = 0;
  const fetcher: Fetcher = async () => {calls++; return new Response('{}');};
  expect(await reply('test', [{type:'text', text:'test'}], '', fetcher)).toEqual({ok:false, code:'invalid_request'});
  expect(calls).toBe(0);
});
it('sends the Flex payload produced by the real renderer instead of rejecting it as missing text', async () => {
  const messages = renderRoute({...routes.find(r=>r.routeId==='notify')!,presentation:'flex'});
  let payload:unknown;
  expect(await reply('test',messages,'test',async (_url, init)=>{payload=JSON.parse(String(init.body)); return new Response('{}');})).toEqual({ok:true});
  expect(payload).toEqual({replyToken:'test',messages});
});
