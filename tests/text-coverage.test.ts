import {expect,it} from 'vitest';
import {resolveAction} from '../src/domain/router';
import {resolveUiCommand} from '../src/line/render';
import {suggestTopic} from '../src/domain/topic-suggestions';
import routes from '../content/routes.json';
import aliases from '../content/aliases.json';
import ui from '../content/ui.json';

it.each([
  ['เจาะเลือดครับ','lab.source.ic04'],
  ['เจาะเลือด ค่ะ','lab.source.ic04'],
  ['เจาะเลือดนะครับ!','lab.source.ic04'],
  ['  เจาะเลือด ครับ !  ','lab.source.ic04'],
  ['เจาะเลือด? ครับ','lab.source.ic04'],
  ['เจาะเลือด??','lab.source.ic04'],
  ['เข็มทิ่มตำ?','first_aid.root'],
  ['โดนเข็มต้องทำยังไงครับ','first_aid.root'],
  ['โดนเข็มทำไง','first_aid.root'],
  ['เข็มตำทำไงคะ','first_aid.root'],
  ['ถูกเข็มตำค่ะ','first_aid.root'],
  ['เข็มตำครับ','first_aid.root'],
  ['เข็มทิ่มค่ะ','first_aid.root'],
  ['โดนเข็มทิ่ม','first_aid.root'],
  ['เข็มทิ่มตำทำไงครับ','first_aid.root'],
  ['เลือดกระเด็นเข้าตาครับ','first_aid.eye'],
  ['กระเด็นเข้าตา','first_aid.eye'],
  ['เลือดกระเด็นเข้าปากค่ะ','first_aid.mouth'],
  ['ตรวจเลือดผู้ป่วยครับ','lab.source.ic04'],
  ['เจาะเลือดผู้ป่วย','lab.source.ic04'],
  ['ขอข้อมูลการเจาะเลือดครับ','lab.source.ic04'],
  ['กรณี ic05','lab.staff.ic05'],
  ['ic04','lab.source.ic04'],
  ['ขอแนวทางปฏิบัติครับ','knowledge.overview'],
  ['ดูแนวทางปฏิบัติค่ะ','knowledge.overview'],
  ['opep คืออะไรครับ','opep.definition'],
])('routes the complete approved phrasing %s to the original answer', (value,id) => {
  const result = resolveAction({kind:'text',value},routes,aliases);
  expect(result.kind).toBe('route');
  if (result.kind === 'route') {
    expect(result.route.routeId).toBe(id);
    expect(result.route.text).toBe(routes.find(route => route.routeId === id)!.text);
  }
});

it.each(['pep','PeP ครับ','opep','oPeP ค่ะ?','รับยา PEP ครับ','การรับยา PEP','ขอข้อมูล oPEP'])('keeps time-of-service choices for %s instead of choosing treatment',value => {
  const result = resolveAction({kind:'text',value},routes,aliases);
  expect(result.kind).toBe('choices');
  if (result.kind === 'choices') expect(result.routes.map(route => route.routeId)).toEqual(['opep.office','opep.after_hours']);
});

it.each([
  ['ผล positive ครับ','lab.source.ic04','lab.source.positive'],
  ['ผล POSITIVE อย่างน้อยหนึ่งตัวค่ะ','lab.source.ic04','lab.source.positive'],
  ['ผล negative ทุกตัวครับ','lab.source.ic04','lab.source.negative'],
  ['ผลลบทุกตัวค่ะ','lab.source.ic04','lab.source.negative'],
  ['ในเวลาราชการครับ','lab.source.positive','exposure.office'],
  ['นอกเวลาราชการค่ะ','lab.source.positive','exposure.after_hours'],
  ['สูตรยาครับ?','opep.office','opep.regimen'],
])('requires and uses the correct context for %s', (value,lastRouteId,id) => {
  const result = resolveAction({kind:'text',value,lastRouteId},routes,aliases);
  expect(result.kind).toBe('route');
  if (result.kind === 'route') expect(result.route.routeId).toBe(id);
  expect(resolveAction({kind:'text',value},routes,aliases)).toEqual({kind:'fallback',reason:'missing_context'});
  expect(resolveAction({kind:'text',value,lastRouteId:'first_aid.eye'},routes,aliases)).toEqual({kind:'fallback',reason:'missing_context'});
});

it('uses the specific existing needle branch in context while the same short phrase can start a fresh topic',() => {
  const result = resolveAction({kind:'text',value:'เข็มตำครับ',lastRouteId:'first_aid.root'},routes,aliases);
  expect(result.kind).toBe('route');
  if (result.kind === 'route') expect(result.route.routeId).toBe('first_aid.sharp_skin');
});

it.each([
  ['สวัสดีครับ!','greeting'],['สวัสดี ครับ','greeting'],['สวัสดีนะคะ?','greeting'],['HELLO!','greeting'],['Hi ครับ','greeting'],
  ['ขอบคุณครับผม','thanks'],['ขอบคุณมากค่ะ!','thanks'],['THANK YOU','thanks'],
  ['เมนูครับ','home'],['ขอเมนูหน่อยครับ','home'],['กลับเมนูหลัก','home'],['ใช้งานยังไง','home'],
  ['เปลี่ยนหัวข้อครับ','reset'],['เริ่มต้นใหม่ค่ะ','reset'],
  ['ฟอร์มรายงานครับ','report'],['ขอลิงก์รายงานค่ะ','report'],['แบบฟอร์มรายงานความเสี่ยง','report'],
  ['ช่องทางติดต่อครับ','contact'],['ติดต่อเจ้าหน้าที่ค่ะ','contact'],
])('recognizes the complete UI phrase %s', (value,command) => {
  expect(resolveUiCommand({kind:'text',value})).toBe(command);
});

it.each(['ผลบวกหรือผลลบครับ','ผล positive และ negative','ไม่ใช่ผลบวกครับ','ผลบวกไม่แน่ใจ','ผลบวก1','ผลบวก-','ผลบวก/ผลลบ','ในเวลา1','IC06 ครับ','IC04.5','IC04-','HBIG ครับ','HN 123 เจาะเลือดครับ','เจาะเลือด นายสมชายครับ','เลือดเข้าตา ต้องใช้ยาอะไรครับ','ไม่ต้องรายงานครับ','สวัสดี ผลบวก','PEP ห้ามรับยา','เจาะเลือดครับผลลบ','เจาะเลือดครับค่ะ'])('never strips clinical meaning or extracts a keyword from %s',value => {
  expect(resolveAction({kind:'text',value,lastRouteId:'lab.source.ic04'},routes,aliases)).toEqual({kind:'fallback',reason:'not_found'});
  expect(resolveUiCommand({kind:'text',value})).toBeNull();
  expect(suggestTopic(value,ui.topicSuggestions)).toBeNull();
});

it('merges case and polite-suffix collisions rather than choosing the first clinical destination',() => {
  const custom = {global:{'อ่าน PEP':['first_aid.eye'],'อ่าน pep ครับ':['first_aid.mouth']},byLastRoute:{}};
  const result = resolveAction({kind:'text',value:'อ่าน PeP!'},routes,custom);
  expect(result.kind).toBe('choices');
  if (result.kind === 'choices') expect(result.routes.map(route => route.routeId)).toEqual(['first_aid.eye','first_aid.mouth']);
});

it.each(['first_aid.eye?','first_aid.eyeครับ','FIRST_AID.EYE',' ui.home '])('never normalizes a postback %s',value => {
  expect(resolveAction({kind:'postback',value},routes,aliases)).toEqual({kind:'fallback',reason:'not_found'});
  expect(resolveUiCommand({kind:'postback',value})).toBeNull();
});

it('retains every registered clinical destination across common case, politeness and terminal punctuation combinations',() => {
  const maps:[string|undefined,Record<string,string[]>][] = [[undefined,aliases.global],...Object.entries(aliases.byLastRoute)];
  for (const [lastRouteId,map] of maps) for (const [alias,ids] of Object.entries(map)) {
    for (const suffix of ['', 'ครับ', ' ค่ะ', 'นะครับ', 'ครับผม', 'คับ', 'นะคะ', 'ค่า']) {
      for (const punctuation of ['', '?', '!', '。', '…', '！？']) {
        const value = alias.toLowerCase()+suffix+punctuation;
        const result = resolveAction({kind:'text',value,lastRouteId},routes,aliases);
        const actual = result.kind === 'route' ? [result.route.routeId] : result.kind === 'choices' ? result.routes.map(route => route.routeId) : [];
        expect(actual,`${lastRouteId ?? 'global'}: ${value}`).toEqual(ids);
      }
    }
  }
});
