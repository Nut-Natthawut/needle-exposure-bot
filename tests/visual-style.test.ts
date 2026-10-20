import {expect,it} from 'vitest';
import routes from '../content/routes.json';
import ui from '../content/ui.json';
import {renderRoute,renderUi,renderChoices} from '../src/line/render';
import type {FlexComponent,FlexMessage} from '../src/line/reply';
import {componentText} from './support/rendered-content';

function components(component:FlexComponent):FlexComponent[] {
  return [component,...(component.type==='box'?component.contents.flatMap(components):[])];
}
function luminance(hex:string):number {
  const rgb=hex.slice(1).match(/../g)!.map(value=>{
    const channel=parseInt(value,16)/255;
    return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
  });
  return rgb[0]!*0.2126+rgb[1]!*0.7152+rgb[2]!*0.0722;
}
function contrast(a:string,b:string):number {
  const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (values[0]!+0.05)/(values[1]!+0.05);
}
function allCards():FlexMessage[] {
  return [...routes.filter(r=>r.enabled).flatMap(renderRoute),...renderUi('home'),
    ...renderUi('report'),...renderUi('contact'),...renderChoices(routes.filter(r=>['opep.office','opep.after_hours'].includes(r.routeId)))]
    .filter((message):message is FlexMessage=>message.type==='flex');
}

it('separates the complete report warning from the white content surface without changing its words or destination',()=>{
  const [message,url]=renderUi('report');
  expect(message?.type).toBe('flex');
  if(message?.type!=='flex')throw new Error('Expected report card');
  const warning=message.contents.body.contents[1];
  expect(warning?.type).toBe('box');
  if(warning?.type!=='box')throw new Error('Expected warning panel');
  expect(componentText(warning)).toBe(ui.reportWarning);
  expect(warning.backgroundColor).toEqual(expect.stringMatching(/^#[0-9A-F]{6}$/i));
  expect(warning.backgroundColor).not.toBe(message.contents.body.backgroundColor);
  for(const item of components(warning))if(item.type==='text') {
    expect(item.wrap).toBe(true);
    expect(contrast(item.color!,warning.backgroundColor!)).toBeGreaterThanOrEqual(4.5);
  }
  expect(message.contents.footer?.contents).toContainEqual(expect.objectContaining({
    action:{type:'uri',label:ui.reportLabel,uri:ui.reportUrl},
  }));
  expect(url).toEqual({type:'text',text:ui.reportUrl});
});

it('uses readable dark brand headers consistently for answers, the menu, choices and reports',()=>{
  for(const card of allCards()) {
    const header=card.contents.body.contents[0];
    if(header?.type!=='box')throw new Error('Expected card heading');
    const title=header.contents[0];
    if(title?.type!=='text')throw new Error('Expected readable heading');
    expect(luminance(header.backgroundColor!)).toBeLessThan(0.15);
    expect(contrast(title.color!,header.backgroundColor!)).toBeGreaterThanOrEqual(7);
    expect(title.wrap).toBe(true);
  }
});

it('keeps wrapped answer and warning lines spaced without clipping their available text',()=>{
  for(const card of allCards()) {
    for(const block of card.contents.body.contents.slice(1))for(const item of components(block)) {
      if(item.type!=='text')continue;
      expect(item.wrap).toBe(true);
      expect(item).not.toHaveProperty('maxLines');
      expect(item).not.toHaveProperty('height');
      const spacing='lineSpacing' in item?Number.parseFloat(String(item.lineSpacing)):0;
      expect(spacing).toBeGreaterThanOrEqual(4);
    }
  }
});

it('visually separates returning home from next-step and form actions while keeping the home destination',()=>{
  for(const card of allCards()) {
    const home=card.contents.footer?.contents.find(item=>item.type==='button'
      &&item.action.type==='postback'&&item.action.data==='ui.home');
    if(!home)continue;
    expect(home).toMatchObject({type:'button',style:'link',
      action:{type:'postback',label:ui.homeLabel,data:'ui.home'}});
  }
});
