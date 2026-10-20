import type { ReplyMessage, FlexComponent, FlexAction } from '../../src/line/reply';

export function componentActions(component:FlexComponent):FlexAction[] {
  if(component.type==='button')return [component.action];
  if(component.type==='box')return component.contents.flatMap(componentActions);
  return [];
}

// Read visible payloads without calling the production formatter. A missing
// line, reordered step, or modified word must fail the approved source baseline.
export function componentText(component: FlexComponent): string {
  if (component.type === 'text') return component.text;
  if (component.type === 'box') return component.contents.map(componentText).join('');
  return '';
}

export function clinicalText(message: ReplyMessage): string {
  if (message.type === 'text') return message.text;
  const clinical = message.contents.body.contents[1];
  if (!clinical || clinical.type !== 'box') throw new Error('Clinical content block missing');
  return clinical.contents.map(componentText).join('\n');
}
