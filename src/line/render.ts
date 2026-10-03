import ui from '../../content/ui.json';
import metadata from '../../content/metadata.json';
import type { Resolution } from '../domain/router';
import type { TextMessage, QuickReplyItem } from './reply';

function buttons(items: {routeId:string; label:string}[]): {items:QuickReplyItem[]} {
  return {items:items.slice(0, 13).map(item => ({type:'action', action:{type:'postback', label:[...item.label].slice(0, 20).join(''), data:item.routeId}}))};
}

// Transitional text renderer for Ticket 4. Flex styling comes in Ticket 6.
export function renderText(result: Resolution): TextMessage[] {
  if (result.kind === 'fallback') {
    const text = result.reason === 'missing_context' ? ui.missingContext : result.reason === 'unavailable' ? ui.unavailable : ui.fallback;
    return [{type:'text', text}];
  }
  if (result.kind === 'choices') {
    const labels: Record<string,string> = ui.choiceLabels;
    return [{type:'text', text:ui.choose, quickReply:buttons(result.routes.map(route => ({routeId:route.routeId, label:labels[route.routeId] ?? ui.genericChoiceLabel})))}];
  }
  const messages: TextMessage[] = [{type:'text', text:result.route.text}];
  if (metadata.partialRouteIds.includes(result.route.routeId)) messages.push({type:'text', text:ui.partialContent});
  const last = messages[messages.length - 1];
  if (last && result.route.next.length) last.quickReply = buttons(result.route.next);
  return messages;
}
