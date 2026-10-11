import ui from '../../content/ui.json';
import metadata from '../../content/metadata.json';
import type { ActionInput, Resolution, Route } from '../domain/router';
import type { ReplyMessage, FlexMessage, FlexComponent, FlexAction, FlexBox, QuickReplyItem } from './reply';

type Link = {routeId:string; label:string};
export type UiCommand = 'home'|'reset'|'report'|'contact'|'opep'|'unsupported';
const colors = {ink:'#173D43', muted:'#46656A', teal:'#007F79', mint:'#E7F5F2', white:'#FFFFFF', warning:'#FFF1F0', warningInk:'#9C3039'};

function text(value:string, color = colors.ink): FlexComponent {
  return {type:'text', text:value, wrap:true, size:'md', color};
}
function actionButton(action:FlexAction, primary = false): FlexComponent {
  return {type:'button', action, height:'md', style:primary ? 'primary':'secondary', ...(primary ? {color:colors.teal} : {}), margin:'sm'};
}
function postbacks(links:readonly Link[]): FlexComponent[] {
  return links.map(link => actionButton({type:'postback',label:link.label,data:link.routeId}));
}
// Split at existing newlines only. Move numbered prefixes, never rewrite or
// invent them. No maxLines: long Thai text wraps instead of disappearing.
function contentBlock(value:string): FlexBox {
  return {type:'box', layout:'vertical', spacing:'md', contents:value.split('\n').map(line => {
    const numbered = /^(\d+\.\s)(.+)$/u.exec(line);
    if (!numbered) return text(line);
    return {type:'box',layout:'horizontal',spacing:'md',contents:[
      {type:'box',layout:'vertical',width:'36px',height:'36px',justifyContent:'center',flex:0,paddingAll:'4px',backgroundColor:colors.teal,cornerRadius:'18px',contents:[{type:'text',text:numbered[1]!,wrap:true,color:colors.white,size:'md',weight:'bold',align:'center'}]},
      {type:'text',text:numbered[2]!,wrap:true,color:colors.ink,size:'md',flex:1},
    ]};
  })};
}
function card(title:string, value:string, actions:FlexComponent[], partial = false): FlexMessage {
  const contents:FlexComponent[] = [
    {type:'box',layout:'vertical',backgroundColor:colors.mint,cornerRadius:'12px',paddingAll:'16px',contents:[{type:'text',text:title,wrap:true,size:'lg',weight:'bold',color:colors.ink}]},
    contentBlock(value),
  ];
  if (partial) contents.push({type:'box',layout:'vertical',backgroundColor:colors.warning,cornerRadius:'12px',paddingAll:'12px',contents:[text(ui.partialContent,colors.warningInk)]});
  return {type:'flex',altText:title,contents:{type:'bubble',size:'mega',
    body:{type:'box',layout:'vertical',contents,spacing:'lg',paddingAll:'20px',backgroundColor:colors.white},
    footer:{type:'box',layout:'vertical',spacing:'sm',paddingAll:'16px',backgroundColor:colors.white,contents:actions},
  }};
}
function homeCard(): FlexMessage {
  return card(ui.homeTitle,ui.homeHelp,postbacks(ui.mainMenu));
}
function homeButton(): FlexComponent {
  return actionButton({type:'postback',label:ui.homeLabel,data:'ui.home'});
}
function quickReply(links:readonly Link[]): {items:QuickReplyItem[]} {
  // Quick Reply permits 20 characters. Longer labels remain intact on the
  // Flex card; never shorten a clinical qualifier to fit a shortcut.
  return {items:links.filter(link=>[...link.label].length <= 20).slice(0,13).map(link=>({type:'action',action:{type:'postback',label:link.label,data:link.routeId}}))};
}
export function resolveUiCommand(input:ActionInput): UiCommand|null {
  const allowed:UiCommand[] = ['home','reset','report','contact','opep'];
  if (input.kind === 'postback') return allowed.find(command=>input.value === `ui.${command}`) ?? null;
  const aliases:Record<string,string> = ui.uiAliases;
  const key = input.value.trim().replace(/\s+/gu,' ');
  const command = Object.hasOwn(aliases,key) ? aliases[key] : undefined;
  return allowed.find(item=>item === command) ?? null;
}
export function renderUi(command:Exclude<UiCommand,'opep'>): ReplyMessage[] {
  if (command === 'report') return [card(ui.reportTitle,ui.reportWarning,[actionButton({type:'uri',label:ui.reportLabel,uri:ui.reportUrl},true),homeButton()]),{type:'text',text:ui.reportUrl}];
  const value = command === 'home' ? ui.welcome : command === 'reset' ? ui.reset : command === 'unsupported' ? ui.unsupported : ui.contactPending;
  return [{type:'text',text:value},homeCard()];
}
export function renderRoute(route:Route): ReplyMessage[] {
  if (!route.enabled) return renderResolution({kind:'fallback',reason:'unavailable'});
  const partial = metadata.partialRouteIds.includes(route.routeId);
  const links = [...route.next];
  if (route.routeId === 'report.ic') links.push({routeId:'ui.report',label:ui.reportLabel});
  if (route.presentation === 'flex') {
    const titles:Record<string,string> = ui.routeTitles;
    const title = titles[route.routeId] ?? ui.genericChoiceLabel;
    const actions:FlexComponent[] = [];
    if (links.length) actions.push({type:'text',text:ui.nextTitle,wrap:true,size:'sm',color:colors.muted});
    actions.push(...postbacks(links),homeButton());
    const message = card(title,route.text,actions,partial);
    message.quickReply = quickReply([...links,{routeId:'ui.home',label:ui.homeLabel}]);
    return [message];
  }
  const messages:ReplyMessage[] = [{type:'text',text:route.text}];
  if (partial) messages.push({type:'text',text:ui.partialContent});
  messages[messages.length-1]!.quickReply = quickReply([...links,{routeId:'ui.home',label:ui.homeLabel}]);
  return messages;
}
export function renderChoices(routes:readonly Route[]): ReplyMessage[] {
  if (!routes.length || routes.some(route=>!route.enabled)) return renderResolution({kind:'fallback',reason:'unavailable'});
  const titles:Record<string,string> = ui.routeTitles;
  const labels:Record<string,string> = ui.choiceLabels;
  return [card(ui.choicesTitle,ui.choose,[...postbacks(routes.map(route=>({routeId:route.routeId,label:labels[route.routeId] ?? titles[route.routeId] ?? ui.genericChoiceLabel}))),homeButton()])];
}
export function renderResolution(result:Resolution): ReplyMessage[] {
  if (result.kind === 'route') return renderRoute(result.route);
  if (result.kind === 'choices') return renderChoices(result.routes);
  const value = result.reason === 'missing_context' ? ui.missingContext : result.reason === 'unavailable' ? ui.unavailable : ui.fallback;
  return [{type:'text',text:value},homeCard()];
}
