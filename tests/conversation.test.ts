import {createHmac} from 'node:crypto';
import {expect,it} from 'vitest';
import {createWebhookHandler} from '../src/index';
import type {ReplyMessage} from '../src/line/reply';
import {MemoryKV} from './support/memory-kv';
import {clinicalText} from './support/rendered-content';
import routes from '../content/routes.json';
import ui from '../content/ui.json';

function conversation() {
  const kv = new MemoryKV();
  const sent:ReplyMessage[][] = [];
  const env = {LINE_CHANNEL_SECRET:'synthetic-secret',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',HMAC_SECRET:'synthetic-hmac',STATE_KV:kv};
  let time = 1000;
  let count = 0;
  const handle = createWebhookHandler(async (_url,init) => {
    sent.push(JSON.parse(String(init.body)).messages);
    return new Response('{}');
  },() => time);
  async function send(value:string,kind:'text'|'postback'='text') {
    const body = JSON.stringify({events:[{type:kind === 'text' ? 'message' : 'postback',webhookEventId:`synthetic-${++count}`,replyToken:'synthetic-reply',source:{type:'user',userId:'synthetic-user'},...(kind === 'text' ? {message:{type:'text',text:value}} : {postback:{data:value}})}]});
    const response = await handle(new Request('https://test.invalid/webhook',{method:'POST',body,headers:{'x-line-signature':createHmac('sha256',env.LINE_CHANNEL_SECRET).update(body).digest('base64')}}),env);
    expect(response.status).toBe(200);
    return sent.at(-1)!;
  }
  return {kv,send,setTime:(value:number) => {time = value;}};
}

it.each(['สวัสดี','สวัสดีครับ','สวัสดีค่ะ','สวัสดีคับ','หวัดดี','  สวัสดีครับ\n','สวัสดีครับ!','HELLO ครับ'])('welcomes %s with the approved short greeting and topic menu',async value => {
  const messages = await conversation().send(value);
  expect(messages[0]).toEqual({type:'text',text:'สวัสดีค่ะ ฉันเป็นบอตเข็มทิ่มตำ NKP\nเลือกหัวข้อที่อยากดูจากเมนูด้านล่างได้เลยค่ะ'});
  expect(messages[1]?.type).toBe('flex');
});

it.each(['ขอบคุณ','ขอบคุณครับ','ขอบคุณค่ะ','ขอบคุณคับ'])('acknowledges %s without clinical advice',async value => {
  const messages = await conversation().send(value);
  expect(messages[0]).toMatchObject({type:'text',text:'ยินดีค่ะ เลือกหัวข้อจากเมนูได้เลยค่ะ'});
  expect(messages[1]?.type).toBe('flex');
});

it.each([
  ['เจาะเลือด','lab.source.ic04'],
  ['โดนเข็มตำ','first_aid.root'],
  ['ปฐมพยาบาล','first_aid.root'],
  ['ความรู้/แนวทางปฏิบัติ','knowledge.overview'],
  ['เจาะเลือดครับ!','lab.source.ic04'],
  ['โดนเข็มต้องทำยังไงครับ','first_aid.root'],
])('uses an explicitly registered topic variant %s without rewriting the answer',async (value,id) => {
  const messages = await conversation().send(value);
  expect(clinicalText(messages[0]!)).toBe(routes.find(route => route.routeId === id)!.text);
});

it.each(['เจาะเลืด','เจาะเลืิอด','เจาะเลืาด','การเจาะเลืด','เจาะเลืดครับ?'])('asks for confirmation before answering the near topic %s',async value => {
  const x = conversation();
  const messages = await x.send(value);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({type:'text',text:'หมายถึงการเจาะเลือดใช่ไหมคะ?'});
  expect(messages[0]?.quickReply?.items.map(item => item.action)).toEqual([
    {type:'postback',label:'ใช่ ดูหัวข้อนี้',data:'lab.source.ic04'},
    {type:'postback',label:'เลือกหัวข้ออื่น',data:'ui.home'},
  ]);
  expect([...x.kv.values.keys()].some(key => key.startsWith('context:'))).toBe(false);
  const confirmed = await x.send('lab.source.ic04','postback');
  expect(clinicalText(confirmed[0]!)).toBe(routes.find(route => route.routeId === 'lab.source.ic04')!.text);
});

it('routes a confirmed reporting topic through the existing warning, never straight to the form',async () => {
  const x = conversation();
  const messages = await x.send('รายงานความเสี่ย');
  expect(messages[0]).toMatchObject({type:'text',text:'หมายถึงรายงานอุบัติการณ์ใช่ไหมคะ?'});
  expect(messages[0]?.quickReply?.items[0]?.action.data).toBe('ui.report');
  const confirmed = await x.send('ui.report','postback');
  expect(confirmed[0]?.type).toBe('flex');
  expect(confirmed[1]).toEqual({type:'text',text:ui.reportUrl});
});

it.each(['ผลบว','ผลล','ในเวล','นอกเวล','IC0','IC06','PE','oPE','HBIG','เจาะเลือด1','เจาะเลือด๑','เจาะเลือด-','สวัสดี ผลบวก','ขอบคุณ ผลลบ','HN 123 เจาะเลืด','เจาะเลือด ผลลบ','ผมติดเชื้อไหม',''])('does not guess medical qualifiers, codes, numbers or sentences: %s',async value => {
  const messages = await conversation().send(value);
  expect(messages[0]).toMatchObject({type:'text',text:'ต้องการดูเรื่องไหนคะ เลือกจากเมนูด้านล่างได้เลย'});
  expect(messages[1]?.type).toBe('flex');
});

it('offers a menu for long text without trying to infer a clinical route',async () => {
  const messages = await conversation().send('เจาะ'.repeat(1000));
  expect(messages[0]).toMatchObject({type:'text',text:ui.fallback});
  expect(messages[1]?.type).toBe('flex');
});

it.each(['สวัสดีคับ','ขอบคุณครับ','ผลบว','แนวทางปฏิบัดิ','ยังไม่เข้าใจ','สวัสดีครับ!','เจาะเลืดครับ?'])('keeps the active topic and original expiry while handling %s',async value => {
  const x = conversation();
  await x.send('การเจาะเลือด');
  const before = [...x.kv.values.entries()].filter(([key]) => key.startsWith('context:'));
  x.setTime(60000);
  await x.send(value);
  expect([...x.kv.values.entries()].filter(([key]) => key.startsWith('context:'))).toEqual(before);
  expect(x.kv.writes.filter(write => write.key.startsWith('context:'))).toHaveLength(1);
  expect(clinicalText((await x.send('ผลบวก'))[0]!)).toBe('กรณีที่ 2: ผล Positive ตัวใดตัวหนึ่ง');
});

it('does not extend clinical context lifetime with a greeting',async () => {
  const x = conversation();
  await x.send('การเจาะเลือด');
  x.setTime(1800000);
  await x.send('สวัสดี');
  x.setTime(1801001);
  expect((await x.send('ผลบวก'))[0]).toMatchObject({type:'text',text:ui.missingContext});
});

it('offers a fresh menu for unknown text without echoing the input',async () => {
  const messages = await conversation().send('HN 12345 ชื่อทดสอบ');
  expect(messages[0]).toMatchObject({type:'text',text:'ต้องการดูเรื่องไหนคะ เลือกจากเมนูด้านล่างได้เลย'});
  expect(JSON.stringify(messages)).not.toContain('12345');
  expect(messages[1]?.type).toBe('flex');
});
