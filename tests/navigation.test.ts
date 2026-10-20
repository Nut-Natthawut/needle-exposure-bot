import {createHmac} from 'node:crypto';
import {expect,it} from 'vitest';
import {createWebhookHandler} from '../src/index';
import {MemoryKV} from './support/memory-kv';
import {clinicalText,componentText,componentActions} from './support/rendered-content';
import type {ReplyMessage} from '../src/line/reply';
import routes from '../content/routes.json';
import aliases from '../content/aliases.json';
import ui from '../content/ui.json';
import {resolveAction} from '../src/domain/router';
import {renderUi,renderRoute,renderChoices} from '../src/line/render';

function setup() {
  const sent:ReplyMessage[][]=[];
  const env={LINE_CHANNEL_SECRET:'synthetic-channel',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-access',HMAC_SECRET:'synthetic-hmac',STATE_KV:new MemoryKV()};
  const handle=createWebhookHandler(async (_url,init)=>{sent.push(JSON.parse(String(init.body)).messages); return new Response('{}');});
  let count=0;
  async function send(value:string,kind:'text'|'postback'='postback') {
    const body=JSON.stringify({events:[{type:kind==='text'?'message':'postback',webhookEventId:`synthetic-${++count}`,replyToken:'synthetic-reply',source:{type:'user',userId:'synthetic-user'},...(kind==='text'?{message:{type:'text',text:value}}:{postback:{data:value}})}]});
    const response=await handle(new Request('https://test.invalid/webhook',{method:'POST',body,headers:{'x-line-signature':createHmac('sha256',env.LINE_CHANNEL_SECRET).update(body).digest('base64')}}),env);
    expect(response.status).toBe(200);
    return sent.at(-1)!;
  }
  return {send};
}
it('signed report menu opens only the approved warning and form, not fallback', async()=>{
  const messages=await setup().send('ui.report');
  expect(messages[0]?.type).toBe('flex');
  if(messages[0]?.type==='flex') expect(componentText(messages[0].contents.body)).toContain(ui.reportWarning);
  expect(messages[1]).toEqual({type:'text',text:ui.reportUrl});
});
it.each(['ติดต่อผู้เกี่ยวข้อง','รายงานอุบัติการณ์','เมนูหลัก'])('routes the exact UI question %s',async value=>{
  const messages=await setup().send(value,'text');
  expect(JSON.stringify(messages)).not.toContain(ui.fallback);
});
it.each([
  ['ui.contact','postback'],
  ['ติดต่อผู้เกี่ยวข้อง','text'],
  ['ช่องทางติดต่อครับ','text'],
  ['ติดต่อเจ้าหน้าที่ค่ะ','text'],
] as const)('returns the supplied contact numbers through the signed webhook for %s',async(value,kind)=>{
  const messages=await setup().send(value,kind);
  expect(messages).toHaveLength(1);
  expect(messages[0]?.type).toBe('flex');
  if(messages[0]?.type!=='flex')throw new Error('Expected contact card');
  expect(componentText(messages[0].contents.body)).toBe(
    'ติดต่อผู้เกี่ยวข้องงานป้องกันและควบคุมการติดเชื้อในโรงพยาบาลห้องตรวจอาชีวเวชกรรมห้องฉุกเฉิน');
  expect(componentActions(messages[0].contents.body).map(action=>action.type==='uri'?action.uri:'')).toEqual([
    'tel:1178','tel:9270','tel:9274','tel:1105','tel:1106','tel:9269',
  ]);
});
it('signed oPEP menu asks for office/after-hours instead of assuming a treatment branch',async()=>{
  const messages=await setup().send('ui.opep');
  expect(messages[0]?.type).toBe('flex');
  if(messages[0]?.type==='flex') expect(messages[0].contents.footer?.contents).toContainEqual(expect.objectContaining({action:{type:'postback',label:'นอกเวลาราชการ',data:'opep.after_hours'}}));
});
it('returns a card for the numbered clinical branch through the real webhook',async()=>{
  const messages=await setup().send('notify');
  expect(messages[0]?.type).toBe('flex');
  expect(clinicalText(messages[0]!)).toBe(routes.find(r=>r.routeId==='notify')!.text);
});
it('follows positive results then lets the user change topic without sticking to the old branch',async()=>{
  const x=setup();
  await x.send('การเจาะเลือด','text');
  const positive=await x.send('ผลบวก','text');
  expect(clinicalText(positive[0]!)).toBe('กรณีที่ 2: ผล Positive ตัวใดตัวหนึ่ง');
  const office=await x.send('ในเวลา','text');
  expect(clinicalText(office[0]!)).toBe(routes.find(r=>r.routeId==='exposure.office')!.text);
  await x.send('ui.home');
  expect((await x.send('ในเวลา','text'))[0]).toMatchObject({type:'text',text:ui.missingContext});
  const eye=await x.send('เลือดเข้าตา','text');
  expect(clinicalText(eye[0]!)).toBe(routes.find(r=>r.routeId==='first_aid.eye')!.text);
});
it.each(['ui.fake','ui.report?HN=123','HN 123 รายงานความเสี่ยง'])('rejects unregistered or identifying UI input %s',async value=>{
  expect((await setup().send(value,value.startsWith('HN')?'text':'postback'))[0]).toMatchObject({type:'text',text:ui.fallback});
});
it('all registered global and context questions resolve to their declared routes',()=>{
  const maps:[string|undefined,Record<string,string[]>][]=[[undefined,aliases.global],...Object.entries(aliases.byLastRoute)];
  for(const [lastRouteId,map] of maps) for(const [value,expected] of Object.entries(map)) {
    const result=resolveAction({kind:'text',value,...(lastRouteId?{lastRouteId}:{})},routes,aliases);
    const actual=result.kind==='route'?[result.route.routeId]:result.kind==='choices'?result.routes.map(r=>r.routeId):[];
    expect(actual,`${lastRouteId??'global'}: ${value}`).toEqual(expected);
  }
});
it('every enabled clinical route is reachable from the declared menus and their next buttons',()=>{
  const visited=new Set<string>();
  const pending:string[]=[];
  function enqueue(messages:ReplyMessage[]) {
    function walk(c:import('../src/line/reply').FlexComponent) {
      if(c.type==='box') c.contents.forEach(walk);
      if(c.type==='button'&&c.action.type==='postback') pending.push(c.action.data);
    }
    for(const m of messages) {
      if(m.type==='flex') {walk(m.contents.body);if(m.contents.footer)walk(m.contents.footer);}
      for(const item of m.quickReply?.items??[]) pending.push(item.action.data);
    }
  }
  enqueue(renderUi('home'));
  const pep=resolveAction({kind:'text',value:'PEP'},routes,aliases);
  expect(pep.kind).toBe('choices');
  if(pep.kind==='choices')enqueue(renderChoices(pep.routes));
  while(pending.length) {
    const id=pending.pop()!;
    if(visited.has(id))continue;
    const route=routes.find(r=>r.routeId===id);
    if(!route?.enabled)continue;
    visited.add(id);enqueue(renderRoute(route));
  }
  expect([...visited].sort()).toEqual(routes.filter(r=>r.enabled).map(r=>r.routeId).sort());
});
