import { expect, it } from 'vitest';
import routes from '../content/routes.json';
import ui from '../content/ui.json';
import metadata from '../content/metadata.json';
import { renderRoute, renderChoices, renderUi, renderResolution, renderTopicSuggestion } from '../src/line/render';
import { clinicalText, componentText, componentActions } from './support/rendered-content';

const find = (id:string) => routes.find(r => r.routeId === id)!;

it('uses the requested feminine voice in outgoing UI without changing accepted user phrasing',() => {
  const messages = [
    ...(['home','reset','report','contact','unsupported','greeting','thanks'] as const).flatMap(renderUi),
    ...(['not_found','missing_context','unavailable'] as const).flatMap(reason => renderResolution({kind:'fallback',reason})),
    ...renderChoices([find('opep.office'),find('opep.after_hours')]),
    ...renderTopicSuggestion(ui.topicSuggestions[1]!),
  ];
  expect(/ครับ|ผม/u.test(JSON.stringify(messages))).toBe(false);
  expect(renderResolution({kind:'fallback',reason:'not_found'})[0]).toMatchObject({type:'text',text:'ต้องการดูเรื่องไหนคะ เลือกจากเมนูด้านล่างได้เลย'});
});

it('keeps short answers as text from the approved corpus', () => {
  expect(renderRoute(find('opep.definition'))[0]).toMatchObject({type:'text',text:'oPEP = Occupational post exposure Prophylaxis'});
});
it('renders numbered source steps in a readable Flex card without changing their wording', () => {
  const message = renderRoute({...find('notify'),presentation:'flex'})[0]!;
  expect(message.type).toBe('flex');
  expect(clinicalText(message)).toBe('หลังการปฐมพยาบาล ให้ดำเนินการตามขั้นตอนดังนี้\n1. แจ้งพยาบาลหัวหน้าเวรประจำหน่วยงานที่บุคลากรเกิดอุบัติเหตุ\n2. ซักประวัติรายละเอียดของการสัมผัสความเสี่ยงของผู้ป่วยและบันทึกหลักฐาน');
  if (message.type === 'flex') {
    expect(message.contents.body.backgroundColor).toBe('#FFFFFF');
    expect(message.contents.footer?.contents).toContainEqual(expect.objectContaining({type:'button',action:{type:'postback',label:'ตรวจเลือดผู้ป่วย',data:'lab.source.ic04'}}));
  }
});
it.each(routes.filter(r => r.enabled).map(r => [r.routeId,r] as const))('preserves the entire clinical answer for %s', (_id, route) => {
  expect(clinicalText(renderRoute({...route,presentation:'flex'})[0]!)).toBe(route.text);
});
it('uses full choice labels and real postback IDs, without truncating clinical qualifiers', () => {
  const [message] = renderChoices([find('lab.source.negative'),find('lab.source.positive')]);
  expect(message?.type).toBe('flex');
  if (message?.type === 'flex') {
    expect(message.contents.footer?.contents).toContainEqual(expect.objectContaining({action:{type:'postback',label:'ผล Positive อย่างน้อยหนึ่งตัว',data:'lab.source.positive'}}));
  }
});
it.each(metadata.partialRouteIds)('shows the partial warning in %s without replacing the answer', id => {
  const messages = renderRoute({...find(id),presentation:'flex'});
  expect(clinicalText(messages[0]!)).toBe(find(id).text);
  expect(messages[0]?.type).toBe('flex');
  if (messages[0]?.type === 'flex') expect(componentText(messages[0].contents.body)).toContain(ui.partialContent);
});
it('never renders disabled clinical content even if called directly', () => {
  const messages = renderRoute(find('lab.staff.ic06'));
  expect(messages[0]).toMatchObject({type:'text',text:ui.unavailable});
  expect(JSON.stringify(messages)).not.toContain(find('lab.staff.ic06').text);
});
it('reports with the approved warning before a URI button and a copyable URL', () => {
  const messages = renderUi('report');
  expect(messages[0]?.type).toBe('flex');
  if (messages[0]?.type === 'flex') {
    expect(componentText(messages[0].contents.body)).toContain(ui.reportWarning);
    expect(messages[0].contents.footer?.contents).toContainEqual(expect.objectContaining({type:'button',action:{type:'uri',label:ui.reportLabel,uri:ui.reportUrl}}));
  }
  expect(messages[1]).toEqual({type:'text',text:ui.reportUrl});
});
it('groups the supplied contacts with a direct phone-app button for each unchanged number', () => {
  const messages = renderUi('contact');
  expect(messages).toHaveLength(1);
  const message = messages[0];
  expect(message?.type).toBe('flex');
  if(message?.type!=='flex')throw new Error('Expected contact card');
  const block = message.contents.body.contents[1];
  if(block?.type!=='box')throw new Error('Expected contact details');
  const groups=block.contents.filter(item=>item.type==='box');
  expect(groups.map(componentText)).toEqual([
    'งานป้องกันและควบคุมการติดเชื้อในโรงพยาบาล1178 / 9270',
    'ห้องตรวจอาชีวเวชกรรม9274',
    'ห้องฉุกเฉิน1105 / 1106 / 9269',
  ]);
  expect(groups.map(componentActions)).toEqual([
    [{type:'uri',label:'โทร 1178',uri:'tel:1178'},{type:'uri',label:'โทร 9270',uri:'tel:9270'}],
    [{type:'uri',label:'โทร 9274',uri:'tel:9274'}],
    [{type:'uri',label:'โทร 1105',uri:'tel:1105'},{type:'uri',label:'โทร 1106',uri:'tel:1106'},{type:'uri',label:'โทร 9269',uri:'tel:9269'}],
  ]);
  expect(message.contents.footer?.contents).toEqual([expect.objectContaining({
    action:{type:'postback',label:'กลับเมนูหลัก',data:'ui.home'},
  })]);
  const payload = JSON.stringify(messages);
  for(const unknown of ['เบอร์ภายใน','053','พรีเมียม','อยู่ระหว่างจัดเตรียม']) expect(payload).not.toContain(unknown);
  expect(componentText(block)).toBe('งานป้องกันและควบคุมการติดเชื้อในโรงพยาบาล1178 / 9270ห้องตรวจอาชีวเวชกรรม9274ห้องฉุกเฉิน1105 / 1106 / 9269');
});
it('offers all six topics even before Rich Menu is installed', () => {
  const messages = renderUi('home');
  expect(messages[0]).toMatchObject({type:'text',text:ui.welcome});
  const menu = messages[1];
  expect(menu?.type).toBe('flex');
  if (menu?.type === 'flex') expect(menu.contents.footer?.contents.filter(c=>c.type==='button').map(c=>c.action.type === 'postback' ? c.action.data : '')).toEqual(['first_aid.root','lab.source.ic04','ui.opep','ui.report','knowledge.overview','ui.contact']);
});
it.each(['not_found','missing_context','unavailable'] as const)('provides a safe way back from %s', reason => {
  const messages = renderResolution({kind:'fallback',reason});
  expect(messages[0]?.type).toBe('text');
  expect(messages[1]?.type).toBe('flex');
});
it('rejects disabled choice candidates rather than hiding them or rendering raw content', () => {
  expect(renderChoices([find('lab.staff.ic06')])[0]).toMatchObject({type:'text',text:ui.unavailable});
});
it('never shortens a clinical choice in Quick Reply while the full label remains on the card',()=>{
  const route=find('lab.source.ic04');
  const [message]=renderRoute(route);
  for(const item of message?.quickReply?.items??[]) {
    const original=route.next.find(link=>link.routeId===item.action.data);
    if(original) expect(item.action.label).toBe(original.label);
  }
  expect(message?.type).toBe('flex');
  if(message?.type==='flex') expect(message.contents.footer?.contents).toContainEqual(expect.objectContaining({action:{type:'postback',label:'ผล Positive อย่างน้อยหนึ่งตัว',data:'lab.source.positive'}}));
});
it('keeps step markers compact even when a Thai step wraps across many lines',()=>{
  const [message]=renderRoute(find('exposure.after_hours'));
  expect(message?.type).toBe('flex');
  if(message?.type==='flex') {
    const block=message.contents.body.contents[1];
    if(block?.type==='box') for(const row of block.contents) if(row.type==='box') {
      expect(row.contents[0]).toMatchObject({type:'box',width:'36px',height:'36px',justifyContent:'center'});
    }
  }
});
it('keeps every current outgoing card and action within LINE limits',()=>{
  const messages=[...routes.filter(r=>r.enabled).flatMap(renderRoute),...renderUi('home'),...renderUi('report'),...renderUi('contact'),...renderChoices([find('opep.office'),find('opep.after_hours')])];
  function check(c:import('../src/line/reply').FlexComponent):void {
    if(c.type==='box') c.contents.forEach(check);
    if(c.type==='button') {
      expect([...c.action.label].length).toBeLessThanOrEqual(40);
      if(c.action.type==='postback') expect(c.action.data.length).toBeLessThanOrEqual(300);
      else expect([ui.reportUrl,'tel:1178','tel:9270','tel:9274','tel:1105','tel:1106','tel:9269']).toContain(c.action.uri);
    }
    if(c.type==='text') {expect(c.wrap).toBe(true);expect(c.text.length).toBeLessThanOrEqual(2000);}
  }
  for(const m of messages) {
    if(m.type==='flex') {
      expect(m.altText.length).toBeLessThanOrEqual(400);
      expect(new TextEncoder().encode(JSON.stringify(m.contents)).length).toBeLessThanOrEqual(30000);
      check(m.contents.body);if(m.contents.footer)check(m.contents.footer);
    } else expect(m.text.length).toBeLessThanOrEqual(5000);
    expect(m.quickReply?.items.length??0).toBeLessThanOrEqual(13);
    for(const item of m.quickReply?.items??[]) expect([...item.action.label].length).toBeLessThanOrEqual(20);
  }
});
