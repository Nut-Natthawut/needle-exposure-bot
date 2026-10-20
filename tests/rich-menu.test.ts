import {readFileSync,statSync} from 'node:fs';
import {expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import {createWebhookHandler} from '../src/index';
import ui from '../content/ui.json';
import type {ReplyMessage} from '../src/line/reply';
import {componentText} from './support/rendered-content';

const config=JSON.parse(readFileSync(new URL('../config/rich-menu.json',import.meta.url),'utf8'));
const ids=['first_aid.root','lab.source.ic04','ui.opep','ui.report','knowledge.overview','ui.contact'];
it('six image tap regions produce the intended real postbacks, not typed labels or form URIs',()=>{
  expect(config.size).toEqual({width:2500,height:1686});
  expect(config.areas).toHaveLength(6);
  expect(config.areas.map((a:any)=>a.action.data)).toEqual(ids);
  for(const area of config.areas) {
    expect(area.action.type).toBe('postback');
    expect(area.action.uri).toBeUndefined();
    expect([...area.action.label].length).toBeLessThanOrEqual(20);
  }
});
it('tap bounds match the final 450px banner and six grid tiles without overlaps or out-of-image regions',()=>{
  expect(config.areas.map((a:any)=>a.bounds)).toEqual([
    {x:0,y:450,width:833,height:615},{x:833,y:450,width:834,height:615},{x:1667,y:450,width:833,height:615},
    {x:0,y:1065,width:833,height:621},{x:833,y:1065,width:834,height:621},{x:1667,y:1065,width:833,height:621},
  ]);
  for(const a of config.areas) {
    const b=a.bounds;
    expect(Object.values(b).every(v=>Number.isInteger(v)&&Number(v)>=0)).toBe(true);
    expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);
    expect(b.x+b.width).toBeLessThanOrEqual(2500);expect(b.y+b.height).toBeLessThanOrEqual(1686);
  }
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++) {
    const a=config.areas[i].bounds,b=config.areas[j].bounds;
    expect(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height).toBe(false);
  }
});
it('upload image is a real 2500x1686 PNG below the agreed 1MB limit',()=>{
  const path=new URL('../assets/rich-menu.png',import.meta.url),png=readFileSync(path);
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(2500);expect(png.readUInt32BE(20)).toBe(1686);
  expect(statSync(path).size).toBeLessThanOrEqual(1_000_000);
});
it('all six actual menu postbacks work through signed webhook; report warns before opening form',async()=>{
  const sent:ReplyMessage[][]=[];
  const env={LINE_CHANNEL_SECRET:'synthetic-secret',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token'};
  const handler=createWebhookHandler(async(_url,init)=>{sent.push(JSON.parse(String(init.body)).messages);return new Response('{}');});
  for(const area of config.areas) {
    const body=JSON.stringify({events:[{type:'postback',source:{type:'user',userId:'synthetic-user'},replyToken:'synthetic-reply',postback:{data:area.action.data}}]});
    expect((await handler(new Request('https://test.invalid/webhook',{method:'POST',body,headers:{'x-line-signature':createHmac('sha256',env.LINE_CHANNEL_SECRET).update(body).digest('base64')}}),env)).status).toBe(200);
    expect(JSON.stringify(sent.at(-1))).not.toContain(ui.fallback);
  }
  expect(sent[3]?.[0]?.type).toBe('flex');
  const report=sent[3]?.[0];
  if(report?.type==='flex') {
    expect(componentText(report.contents.body)).toContain(ui.reportWarning);
    expect(report.contents.footer?.contents).toContainEqual(expect.objectContaining({action:{type:'uri',label:ui.reportLabel,uri:ui.reportUrl}}));
  }
  expect(sent[3]?.[1]).toEqual({type:'text',text:ui.reportUrl});
  expect(sent[5]).toHaveLength(1);
  const contact=sent[5]?.[0];
  expect(contact?.type).toBe('flex');
  if(contact?.type==='flex') expect(componentText(contact.contents.body)).toBe(
    'ติดต่อผู้เกี่ยวข้องงานป้องกันและควบคุมการติดเชื้อในโรงพยาบาล1178 / 9270ห้องตรวจอาชีวเวชกรรม9274ห้องฉุกเฉิน1105 / 1106 / 9269');
});
