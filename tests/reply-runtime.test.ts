import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions, Response as RuntimeResponse} from 'miniflare';
import {expect, it} from 'vitest';
import {createHmac} from 'node:crypto';
import routes from '../content/routes.json';
import ui from '../content/ui.json';
import type {ReplyMessage} from '../src/line/reply';
import {clinicalText,componentText,componentActions} from './support/rendered-content';

// Real reply implementation + native workerd fetch. Only the external API is fake.
// Node fetch doubles cannot detect unsupported Workers RequestInit options.
async function runReply(upstreamStatus: number) {
  const bundle = await build({
    stdin:{contents:`import {reply} from './src/line/reply';
      export default {async fetch() {
        return Response.json(await reply('synthetic-reply', [{type:'text',text:'synthetic message'}], 'synthetic-access'));
      }};`, resolveDir:process.cwd(), loader:'ts'},
    bundle:true, write:false, format:'esm', platform:'browser', target:'es2022',
  });
  const requests: {url:string; authorization:string|null; payload:unknown}[] = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules:true, script:bundle.outputFiles[0]!.text,
    compatibilityDate:'2026-10-03', compatibilityFlags:['nodejs_compat'],
    outboundService:async request => {
      requests.push({url:request.url, authorization:request.headers.get('authorization'), payload:await request.json()});
      return new RuntimeResponse('{}', {status:upstreamStatus,
        ...(upstreamStatus === 302 ? {headers:{Location:'https://redirect.invalid/'}} : {})});
    },
  }));
  try {
    const response = await runtime.dispatchFetch('https://test.invalid/');
    return {result:await response.json(), requests};
  } finally {await runtime.dispose();}
}

it('native Workers fetch reaches Reply API and accepts a successful response', async () => {
  const {result, requests} = await runReply(200);
  expect(result).toEqual({ok:true});
  expect(requests).toEqual([{url:'https://api.line.me/v2/bot/message/reply', authorization:'Bearer synthetic-access',
    payload:{replyToken:'synthetic-reply', messages:[{type:'text',text:'synthetic message'}]}}]);
});
it('native Workers fetch reports upstream rejection, not a misleading network failure', async () => {
  const {result, requests} = await runReply(401);
  expect(result).toEqual({ok:false, code:'http_error', status:401});
  expect(requests).toHaveLength(1);
});
it('does not follow a redirect or forward credentials to its destination', async () => {
  const {result, requests} = await runReply(302);
  expect(result).toEqual({ok:false, code:'http_error', status:302});
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe('https://api.line.me/v2/bot/message/reply');
});
it('signed real webhook replies successfully through the native Workers transport', async () => {
  const bundle = await build({stdin:{contents:"import worker from './src/index'; export default worker;",
    resolveDir:process.cwd(), loader:'ts'}, bundle:true, write:false, format:'esm', platform:'browser', target:'es2022'});
  const body = JSON.stringify({events:[{type:'message',webhookEventId:'synthetic-event',replyToken:'synthetic-reply',
    source:{type:'user',userId:'synthetic-user'},message:{type:'text',text:'การเจาะเลือด'}}]});
  const destinations:string[] = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({modules:true, script:bundle.outputFiles[0]!.text,
    compatibilityDate:'2026-10-03', compatibilityFlags:['nodejs_compat'],
    bindings:{LINE_CHANNEL_SECRET:'synthetic-secret',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-access'},
    outboundService:async request => {destinations.push(request.url); return new RuntimeResponse('{}');},
  }));
  try {
    const response = await runtime.dispatchFetch('https://test.invalid/webhook', {method:'POST', body,
      headers:{'x-line-signature':createHmac('sha256','synthetic-secret').update(body).digest('base64')}});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
    expect(destinations).toEqual(['https://api.line.me/v2/bot/message/reply']);
  } finally {await runtime.dispose();}
});
it('native Worker delivers every enabled answer and UI command as complete LINE payloads',async()=>{
  const bundle=await build({stdin:{contents:"import worker from './src/index'; export default worker;",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  const payloads:{messages:ReplyMessage[]}[]=[];
  const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-10-03',compatibilityFlags:['nodejs_compat'],bindings:{LINE_CHANNEL_SECRET:'synthetic-secret',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-access'},outboundService:async request=>{payloads.push(await request.json() as {messages:ReplyMessage[]}); return new RuntimeResponse('{}');}}));
  try {
    const cases:[string,'postback'|'text'][] = [
      ...[...routes.filter(r=>r.enabled).map(r=>r.routeId),'ui.home','ui.report','ui.contact','ui.opep','ui.reset'].map(value => [value,'postback'] as [string,'postback']),
      ['สวัสดีคับ','text'],['ขอบคุณครับ','text'],['เจาะเลืด','text'],
      ['สวัสดีครับ!','text'],['เจาะเลือดครับ!','text'],['pep ครับ','text'],['เจาะเลืดครับ?','text'],
    ];
    for(const [value,kind] of cases) {
      const body=JSON.stringify({events:[{type:kind==='text'?'message':'postback',webhookEventId:`synthetic-${value}`,replyToken:'synthetic-reply',source:{type:'user',userId:'synthetic-user'},...(kind==='text'?{message:{type:'text',text:value}}:{postback:{data:value}})}]});
      const response=await runtime.dispatchFetch('https://test.invalid/webhook',{method:'POST',body,headers:{'x-line-signature':createHmac('sha256','synthetic-secret').update(body).digest('base64')}});
      expect(response.status,value).toBe(200);
      const route=routes.find(r=>r.routeId===value);
      if(route) expect(clinicalText(payloads.at(-1)!.messages[0]!),value).toBe(route.text);
      else expect(JSON.stringify(payloads.at(-1))).not.toContain(ui.fallback);
      if(value==='เจาะเลืด'||value==='เจาะเลืดครับ?') expect(payloads.at(-1)!.messages[0]).toMatchObject({type:'text',text:'หมายถึงการเจาะเลือดใช่ไหมคะ?',quickReply:{items:[{type:'action',action:{type:'postback',label:'ใช่ ดูหัวข้อนี้',data:'lab.source.ic04'}},{type:'action',action:{type:'postback',label:'เลือกหัวข้ออื่น',data:'ui.home'}}]}});
      if(value==='เจาะเลือดครับ!') expect(clinicalText(payloads.at(-1)!.messages[0]!)).toBe(routes.find(route=>route.routeId==='lab.source.ic04')!.text);
      if(value==='ui.contact') {
        const contact=payloads.at(-1)!.messages[0];
        if(contact?.type!=='flex')throw new Error('Expected contact card');
        expect(componentText(contact.contents.body)).toContain('งานป้องกันและควบคุมการติดเชื้อในโรงพยาบาล1178 / 9270ห้องตรวจอาชีวเวชกรรม9274ห้องฉุกเฉิน1105 / 1106 / 9269');
        expect(componentActions(contact.contents.body).map(action=>action.type==='uri'?action.uri:'')).toEqual(['tel:1178','tel:9270','tel:9274','tel:1105','tel:1106','tel:9269']);
      }
    }
    expect(payloads).toHaveLength(39);
  } finally {await runtime.dispose();}
});
