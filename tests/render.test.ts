import { expect, it } from 'vitest';
import routes from '../content/routes.json';
import ui from '../content/ui.json';
import metadata from '../content/metadata.json';
import { renderRoute, renderChoices, renderUi, renderResolution } from '../src/line/render';
import { clinicalText, componentText } from './support/rendered-content';

const find = (id:string) => routes.find(r => r.routeId === id)!;

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
it('keeps contact pending, without inventing a phone or person', () => {
  expect(renderUi('contact')[0]).toMatchObject({type:'text',text:ui.contactPending});
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
      else expect(c.action.uri).toBe(ui.reportUrl);
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
